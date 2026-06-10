import prisma from "../config/prisma.js";

function parseDateOrNull(x) {
  if (!x) return null;
  const d = new Date(String(x));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// group: day|week|month|year
function normalizeGroup(group) {
  const g = String(group || "day").toLowerCase();
  if (!["day", "week", "month", "year"].includes(g)) return "day";
  return g;
}

class GroceryReportService {
  // ✅ Sales Summary Report with Date Filter
 async salesSummary(owner_id, { start, end }) {
    const startDate = parseDateOrNull(start);
    const endDate = parseDateOrNull(end);

    const startFinal = startDate
      ? startOfDay(startDate)
      : startOfDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const endFinal = endDate ? endOfDay(endDate) : endOfDay(new Date());

    const rows = await prisma.$queryRaw`
      WITH sold AS (
        SELECT
          gs.sales_id,
          gs.paid_amount,
          gs.discount,
          GREATEST(gs.total_amount - COALESCE(gs.discount, 0), 0) AS effective_total,
          COALESCE(SUM(gsi.cp * gsi.qty), 0) AS sold_cost
        FROM grocery_sales_items gsi
        JOIN grocery_sales gs ON gs.sales_id = gsi.sales_id
        WHERE gs.owner_id = ${owner_id}
          AND gs.created_at >= ${startFinal}
          AND gs.created_at <= ${endFinal}
        GROUP BY gs.sales_id, gs.paid_amount, gs.total_amount, gs.discount
      ),
      returns AS (
        SELECT
          gcr.sales_id,
          COALESCE(SUM(gcr.refund_amount), 0) AS total_refund,
          COALESCE(SUM(gsi.cp * gcri.qty), 0) AS returned_cost,
          COUNT(DISTINCT gcr.return_id)::int AS return_count
        FROM grocery_customer_returns gcr
        INNER JOIN sold s ON s.sales_id = gcr.sales_id
        LEFT JOIN grocery_customer_return_items gcri ON gcri.return_id = gcr.return_id
        LEFT JOIN grocery_sales_items gsi ON gsi.sales_item_id = gcri.sales_item_id
        WHERE gcr.owner_id = ${owner_id}
        GROUP BY gcr.sales_id
      ),
      per_sale AS (
        SELECT
          s.sales_id,
          s.effective_total,
          s.paid_amount,
          s.sold_cost,
          s.discount,
          COALESCE(r.total_refund, 0) AS total_refund,
          COALESCE(r.returned_cost, 0) AS returned_cost,
          COALESCE(r.return_count, 0) AS return_count,
          -- net_paid per sale (same logic as clothing)
          GREATEST(0,
            s.paid_amount - GREATEST(0,
              COALESCE(r.total_refund, 0) - GREATEST(0, s.effective_total - s.paid_amount)
            )
          ) AS net_paid,
          -- due per sale
          GREATEST(0,
            (s.effective_total - COALESCE(r.total_refund, 0)) -
            GREATEST(0,
              s.paid_amount - GREATEST(0,
                COALESCE(r.total_refund, 0) - GREATEST(0, s.effective_total - s.paid_amount)
              )
            )
          ) AS due
        FROM sold s
        LEFT JOIN returns r ON r.sales_id = s.sales_id
      )
      SELECT
        COUNT(sales_id)::int AS sales_count,
        COALESCE(SUM(effective_total), 0)::numeric AS effective_total,
        COALESCE(SUM(discount), 0)::numeric AS total_discount,
        COALESCE(SUM(effective_total - total_refund), 0)::numeric AS actual_revenue,
        COALESCE(SUM(sold_cost - returned_cost), 0)::numeric AS net_cost,
        COALESCE(SUM(net_paid), 0)::numeric AS total_paid,
        COALESCE(SUM(due), 0)::numeric AS due_balance,
        COALESCE(SUM(return_count), 0)::int AS return_count
      FROM per_sale
    `;

    const row = rows[0];
    const salesCount = Number(row?.sales_count || 0);
    const effectiveTotal = Number(row?.effective_total || 0);
    const totalDiscount = Number(row?.total_discount || 0);
    const actualRevenue = Number(row?.actual_revenue || 0);
    const netCost = Number(row?.net_cost || 0);
    const totalPaid = Number(row?.total_paid || 0);
    const dueBalance = Number(row?.due_balance || 0);
    const returnCount = Number(row?.return_count || 0);
    const profitOrLoss = actualRevenue - netCost;

    return {
      date_range: {
        start: startFinal.toISOString(),
        end: endFinal.toISOString(),
      },
      summary: {
        total_sales: effectiveTotal,
        total_discount: totalDiscount,
        effective_sales: actualRevenue,
        total_cost: netCost,
        total_paid: totalPaid,
        due_balance: dueBalance,
        estimated_profit: profitOrLoss,
        sales_count: salesCount,
        return_count: returnCount,
      },
      breakdown: {
        gross_discount: totalDiscount,
        gross_cost: netCost,
        gross_paid: totalPaid,
        actual_revenue: actualRevenue,
        profit_or_loss: profitOrLoss,
      },
    };
  }

  // ✅ Top Selling Products with Date Filter
  async topProducts(owner_id, { start, end, limit = 10 }) {
    const startDate = parseDateOrNull(start);
    const endDate = parseDateOrNull(end);

    // Default: last 30 days
    const startFinal = startDate
      ? startOfDay(startDate)
      : startOfDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    const endFinal = endDate ? endOfDay(endDate) : endOfDay(new Date());

    const lim = Math.min(Math.max(Number(limit || 10), 1), 50);

    const rows = await prisma.$queryRawUnsafe(
      `
        WITH sold AS (
          SELECT
            gsi.product_id,
            SUM(gsi.qty)::numeric AS qty_sold,
            SUM(gsi.line_total)::numeric AS revenue
          FROM grocery_sales_items gsi
          JOIN grocery_sales gs ON gs.sales_id = gsi.sales_id
          WHERE gs.owner_id = $1
            AND gs.created_at >= $2
            AND gs.created_at <= $3
          GROUP BY 1
        ),
        ret AS (
          SELECT
            gsi.product_id,
            SUM(gcri.qty)::numeric AS qty_returned,
            SUM(gsi.sp * gcri.qty)::numeric AS return_value
          FROM grocery_customer_return_items gcri
          JOIN grocery_customer_returns gcr ON gcr.return_id = gcri.return_id
          JOIN grocery_sales_items gsi ON gsi.sales_item_id = gcri.sales_item_id
          WHERE gcr.owner_id = $1
            AND gcr.created_at >= $2
            AND gcr.created_at <= $3
          GROUP BY 1
        )
        SELECT
          p.product_id,
          p.product_name,
          (COALESCE(s.qty_sold, 0) - COALESCE(r.qty_returned, 0))::numeric AS net_qty,
          (COALESCE(s.revenue, 0) - COALESCE(r.return_value, 0))::numeric AS net_revenue,
          u.unit_name
        FROM grocery_products p
        LEFT JOIN sold s ON s.product_id = p.product_id
        LEFT JOIN ret r ON r.product_id = p.product_id
        LEFT JOIN grocery_units u ON u.unit_id = p.unit_id
        WHERE p.owner_id = $1
          AND (COALESCE(s.qty_sold, 0) - COALESCE(r.qty_returned, 0)) > 0
        ORDER BY net_qty DESC
        LIMIT $4;
      `,
      owner_id,
      startFinal,
      endFinal,
      lim
    );

    return rows.map((x) => ({
      product_id: x.product_id,
      product_name: x.product_name,
      qty: Number(x.net_qty || 0),
      revenue: Number(x.net_revenue || 0),
      unit: x.unit_name || "units",
    }));
  }

  // ✅ Stock Flow Report (Stock In, Stock Out, Sales, Profit)
  async stockFlow(owner_id, { start, end, group }) {
    const g = normalizeGroup(group);
    const startDate = parseDateOrNull(start);
    const endDate = parseDateOrNull(end);

    // Default: last 30 days
    const startFinal = startDate
      ? startOfDay(startDate)
      : startOfDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    const endFinal = endDate ? endOfDay(endDate) : endOfDay(new Date());

    const rows = await prisma.$queryRaw`
      WITH qty_in AS (
        SELECT
          date_trunc(${g}, gsl.created_at) AS period,
          SUM(gsl.qty_in)::numeric AS qty_in
        FROM grocery_stock_lots gsl
        WHERE gsl.owner_id = ${owner_id}
          AND gsl.created_at >= ${startFinal}
          AND gsl.created_at <= ${endFinal}
        GROUP BY 1
      ),
      qty_out AS (
        SELECT
          date_trunc(${g}, gs.created_at) AS period,
          SUM(gsi.qty)::numeric AS qty_out,
          SUM(gsi.line_total)::numeric AS sales,
          SUM((gsi.cp * gsi.qty))::numeric AS cost
        FROM grocery_sales_items gsi
        JOIN grocery_sales gs ON gs.sales_id = gsi.sales_id
        WHERE gs.owner_id = ${owner_id}
          AND gs.created_at >= ${startFinal}
          AND gs.created_at <= ${endFinal}
        GROUP BY 1
      ),
      discounts AS (
        SELECT
          date_trunc(${g}, created_at) AS period,
          SUM(discount)::numeric AS discount_total
        FROM grocery_sales
        WHERE owner_id = ${owner_id}
          AND created_at >= ${startFinal}
          AND created_at <= ${endFinal}
        GROUP BY 1
      ),
      returns AS (
        SELECT
          date_trunc(${g}, gcr.created_at) AS period,
          SUM(gcri.qty)::numeric AS qty_returned,
          SUM((gsi.sp * gcri.qty))::numeric AS return_value,
          SUM((gsi.cp * gcri.qty))::numeric AS returned_cost
        FROM grocery_customer_return_items gcri
        JOIN grocery_customer_returns gcr ON gcr.return_id = gcri.return_id
        LEFT JOIN grocery_sales_items gsi ON gsi.sales_item_id = gcri.sales_item_id
        WHERE gcr.owner_id = ${owner_id}
          AND gcr.created_at >= ${startFinal}
          AND gcr.created_at <= ${endFinal}
        GROUP BY 1
      )
      SELECT
        COALESCE(i.period, o.period, d.period, r.period) AS period,
        COALESCE(i.qty_in, 0) AS qty_in,
        (COALESCE(o.qty_out, 0) - COALESCE(r.qty_returned, 0)) AS net_qty_out,
        (COALESCE(o.sales, 0) - COALESCE(r.return_value, 0)) AS gross_sales,
        COALESCE(d.discount_total, 0) AS discount,
        COALESCE(o.cost, 0) - COALESCE(r.returned_cost, 0) AS cost,
        (COALESCE(o.sales, 0) - COALESCE(r.return_value, 0) - COALESCE(d.discount_total, 0)) - (COALESCE(o.cost, 0) - COALESCE(r.returned_cost, 0)) AS profit
      FROM qty_in i
      FULL OUTER JOIN qty_out o ON o.period = i.period
      FULL OUTER JOIN discounts d ON d.period = COALESCE(i.period, o.period)
      FULL OUTER JOIN returns r ON r.period = COALESCE(i.period, o.period, d.period)
      WHERE (COALESCE(o.qty_out, 0) > 0 OR COALESCE(r.qty_returned, 0) > 0)
      ORDER BY period ASC;
    `;


    return rows.map((r) => ({
      period: new Date(r.period).toISOString(),
      qty_in: Number(r.qty_in || 0),
      qty_out: Number(r.net_qty_out || 0),
      gross_sales: Number(r.gross_sales || 0),
      discount: Number(r.discount || 0),
      sales: Number(r.gross_sales || 0) - Number(r.discount || 0), // Effective total
      cost: Number(r.cost || 0),
      profit: Number(r.profit || 0), // Effective total - cost
    }));
  }

  // ✅ Return Analytics (Simplified for Grocery - No Condition Tracking)
  async returnAnalytics(owner_id, { start, end }) {
    const startDate = parseDateOrNull(start);
    const endDate = parseDateOrNull(end);

    // Default: last 30 days
    const startFinal = startDate
      ? startOfDay(startDate)
      : startOfDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    const endFinal = endDate ? endOfDay(endDate) : endOfDay(new Date());

    // 1) Summary Stats
    const summaryRows = await prisma.$queryRaw`
      SELECT
        COUNT(DISTINCT gcr.return_id)::int AS total_returns,
        COALESCE(SUM(gcri.qty), 0)::numeric AS total_qty,
        COALESCE(SUM(gcr.refund_amount), 0)::numeric AS total_refund,
        COALESCE(SUM(gsi.sp * gcri.qty), 0)::numeric AS return_value
      FROM grocery_customer_return_items gcri
      JOIN grocery_customer_returns gcr
        ON gcr.return_id = gcri.return_id
      LEFT JOIN grocery_sales_items gsi
        ON gsi.sales_item_id = gcri.sales_item_id
      WHERE gcr.owner_id = ${owner_id}
        AND gcr.created_at >= ${startFinal}
        AND gcr.created_at <= ${endFinal};
    `;

    // 2) Top Returned Products (Top 10)
    const productRows = await prisma.$queryRaw`
      SELECT
        p.product_id,
        p.product_name,
        COALESCE(SUM(gcri.qty), 0)::numeric AS total_qty,
        COALESCE(SUM(gsi.sp * gcri.qty), 0)::numeric AS return_value,
        COUNT(DISTINCT gcr.return_id)::int AS return_count,
        u.unit_name
      FROM grocery_customer_return_items gcri
      JOIN grocery_customer_returns gcr
        ON gcr.return_id = gcri.return_id
      LEFT JOIN grocery_sales_items gsi
        ON gsi.sales_item_id = gcri.sales_item_id
      LEFT JOIN grocery_products p
        ON p.product_id = gsi.product_id
      LEFT JOIN grocery_units u
        ON u.unit_id = p.unit_id
      WHERE gcr.owner_id = ${owner_id}
        AND gcr.created_at >= ${startFinal}
        AND gcr.created_at <= ${endFinal}
      GROUP BY p.product_id, p.product_name, u.unit_name
      ORDER BY total_qty DESC
      LIMIT 10;
    `;

    const s = summaryRows[0] || {};
    const totalReturns = Number(s.total_returns || 0);
    const totalQty = Number(s.total_qty || 0);
    const totalRefund = Number(s.total_refund || 0);
    const returnValue = Number(s.return_value || 0);

    return {
      date_range: {
        start: startFinal.toISOString(),
        end: endFinal.toISOString(),
      },
      summary: {
        total_returns: totalReturns,
        total_qty: totalQty,
        total_refund: totalRefund,
        return_value: returnValue,
        avg_return_value: totalReturns > 0 ? returnValue / totalReturns : 0,
      },
      top_products: productRows.map((x) => ({
        product_id: x.product_id,
        product_name: x.product_name || "Unknown Product",
        total_qty: Number(x.total_qty || 0),
        return_value: Number(x.return_value || 0),
        return_count: Number(x.return_count || 0),
        unit: x.unit_name || "units",
      })),
    };
  }
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export default new GroceryReportService();
