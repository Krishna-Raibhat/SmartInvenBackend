import { prisma } from "../prisma/client.js";

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

class ClothingReportService {
  // ✅ Chart: Sales vs Cost vs Paid (grouped by date)
  async salesCostPaid(owner_id, { start, end, group }) {
    const g = normalizeGroup(group);
    const startDate = parseDateOrNull(start);
    const endDate = parseDateOrNull(end);

    const startFinal = startDate
      ? startOfDay(startDate)
      : startOfDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    const endFinal = endDate ? endOfDay(endDate) : endOfDay(new Date());

    const rows = await prisma.$queryRaw`
      WITH sales_with_effective AS (
        SELECT
          date_trunc(${g}, cs.created_at) AS period,
          cs.sales_id,
          -- Effective total = total_amount - discount for each sale
          GREATEST(cs.total_amount - COALESCE(cs.discount, 0), 0) AS effective_total
        FROM clothing_sales cs
        WHERE cs.owner_id = ${owner_id}
          AND cs.created_at >= ${startFinal}
          AND cs.created_at <= ${endFinal}
      ),
      sales_grouped AS (
        SELECT
          period,
          SUM(effective_total)::numeric AS total_effective_sales
        FROM sales_with_effective
        GROUP BY period
      ),
      cost_grouped AS (
        SELECT
          date_trunc(${g}, cs.created_at) AS period,
          SUM((csi.cp * csi.qty))::numeric AS cost
        FROM clothing_sales_items csi
        JOIN clothing_sales cs ON cs.sales_id = csi.sales_id
        WHERE cs.owner_id = ${owner_id}
          AND cs.created_at >= ${startFinal}
          AND cs.created_at <= ${endFinal}
        GROUP BY 1
      ),
      paid AS (
        SELECT
          date_trunc(${g}, created_at) AS period,
          SUM(paid_amount)::numeric AS paid_total
        FROM clothing_sales
        WHERE owner_id = ${owner_id}
          AND created_at >= ${startFinal}
          AND created_at <= ${endFinal}
        GROUP BY 1
      ),
      returns AS (
        SELECT
          date_trunc(${g}, ccr.created_at) AS period,
          SUM(COALESCE(ccr.refund_amount, 0))::numeric AS refund_total
        FROM clothing_customer_returns ccr
        WHERE ccr.owner_id = ${owner_id}
          AND ccr.created_at >= ${startFinal}
          AND ccr.created_at <= ${endFinal}
        GROUP BY 1
      )
      SELECT
        COALESCE(sg.period, cg.period, p.period, r.period) AS period,
        COALESCE(sg.total_effective_sales, 0) AS effective_sales,
        COALESCE(cg.cost, 0) AS cost,
        COALESCE(p.paid_total, 0) AS paid,
        COALESCE(r.refund_total, 0) AS refund_total
      FROM sales_grouped sg
      FULL OUTER JOIN cost_grouped cg ON cg.period = sg.period
      FULL OUTER JOIN paid p ON p.period = COALESCE(sg.period, cg.period)
      FULL OUTER JOIN returns r ON r.period = COALESCE(sg.period, cg.period, p.period)
      ORDER BY period ASC;
    `;

    return rows.map((r) => {
      const effectiveSales = Number(r.effective_sales || 0);
      const refund = Number(r.refund_total || 0);
      const revenue = effectiveSales - refund; // Revenue after refunds
      const cost = Number(r.cost || 0);
      const paid = Number(r.paid || 0);
      const profit = revenue - cost;
      const due = revenue - paid;
      
      return {
        period: new Date(r.period).toISOString(),
        sales: revenue, // Net revenue (effective sales - refunds)
        effective_sales: effectiveSales, // Before refunds
        refund,
        cost,
        paid,
        profit,
        balance: due > 0 ? due : 0,
      };
    });
  }

  async topProducts(owner_id, { start, end, limit = 3 }) {
    const startDate = parseDateOrNull(start);
    const endDate = parseDateOrNull(end);

    const startFinal = startDate
      ? startOfDay(startDate)
      : startOfDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    const endFinal = endDate ? endOfDay(endDate) : endOfDay(new Date());

    const lim = Math.min(Math.max(Number(limit || 3), 1), 20);

    const rows = await prisma.$queryRawUnsafe(
      `
        WITH sold AS (
        SELECT
            csi.product_id,
            SUM(csi.qty)::int AS qty_sold
        FROM clothing_sales_items csi
        JOIN clothing_sales cs ON cs.sales_id = csi.sales_id
        WHERE cs.owner_id = $1
            AND cs.created_at >= $2
            AND cs.created_at <= $3
        GROUP BY 1
        ),
        ret AS (
        SELECT
            csi.product_id,
            SUM(ccri.qty)::int AS qty_returned
        FROM clothing_customer_return_items ccri
        JOIN clothing_customer_returns ccr ON ccr.return_id = ccri.return_id
        JOIN clothing_sales_items csi ON csi.sales_item_id = ccri.sales_item_id
        WHERE ccr.owner_id = $1
            AND ccr.created_at >= $2
            AND ccr.created_at <= $3
        GROUP BY 1
        )
        SELECT
        p.product_id,
        p.product_name,
        (COALESCE(s.qty_sold,0) - COALESCE(r.qty_returned,0))::int AS net_qty
        FROM clothing_products p
        LEFT JOIN sold s ON s.product_id = p.product_id
        LEFT JOIN ret r ON r.product_id = p.product_id
        WHERE p.owner_id = $1
        ORDER BY net_qty DESC
        LIMIT $4;
        `,
      owner_id,
      startFinal,
      endFinal,
      lim,
    );

    return rows.map((x) => ({
      product_id: x.product_id,
      product_name: x.product_name,
      qty: Number(x.net_qty || 0),
    }));
  }

  async stockFlow(owner_id, { start, end, group }) {
    const g = normalizeGroup(group);
    const startDate = parseDateOrNull(start);
    const endDate = parseDateOrNull(end);

    const startFinal = startDate
      ? startOfDay(startDate)
      : startOfDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    const endFinal = endDate ? endOfDay(endDate) : endOfDay(new Date());

    const rows = await prisma.$queryRaw`
      WITH qty_in AS (
        SELECT
          date_trunc(${g}, csl.created_at) AS period,
          SUM(csl.qty_in)::int AS qty_in
        FROM clothing_stock_lots csl
        JOIN clothing_products p ON p.product_id = csl.product_id
        WHERE p.owner_id = ${owner_id}
          AND csl.created_at >= ${startFinal}
          AND csl.created_at <= ${endFinal}
        GROUP BY 1
      ),
      
      qty_out AS (
        SELECT
          date_trunc(${g}, cs.created_at) AS period,
          SUM(csi.qty)::int AS qty_out,
          SUM(csi.line_total)::numeric AS sales,
          SUM((csi.cp * csi.qty))::numeric AS cost
        FROM clothing_sales_items csi
        JOIN clothing_sales cs ON cs.sales_id = csi.sales_id
        WHERE cs.owner_id = ${owner_id}
          AND cs.created_at >= ${startFinal}
          AND cs.created_at <= ${endFinal}
        GROUP BY 1
      ),
      discounts AS (
        SELECT
          date_trunc(${g}, created_at) AS period,
          SUM(discount)::numeric AS discount_total
        FROM clothing_sales
        WHERE owner_id = ${owner_id}
          AND created_at >= ${startFinal}
          AND created_at <= ${endFinal}
        GROUP BY 1
      ),
      returns AS (
        SELECT
          date_trunc(${g}, ccr.created_at) AS period,
          SUM(ccri.qty)::int AS qty_returned,
          SUM((csi.sp * ccri.qty))::numeric AS return_value
        FROM clothing_customer_return_items ccri
        JOIN clothing_customer_returns ccr ON ccr.return_id = ccri.return_id
        LEFT JOIN clothing_sales_items csi ON csi.sales_item_id = ccri.sales_item_id
        WHERE ccr.owner_id = ${owner_id}
          AND ccr.created_at >= ${startFinal}
          AND ccr.created_at <= ${endFinal}
        GROUP BY 1
      )
      SELECT
        COALESCE(i.period, o.period, d.period, r.period) AS period,
        COALESCE(i.qty_in, 0) AS qty_in,
        (COALESCE(o.qty_out, 0) - COALESCE(r.qty_returned, 0)) AS net_qty_out,
        (COALESCE(o.sales, 0) - COALESCE(r.return_value, 0)) AS gross_sales,
        COALESCE(d.discount_total, 0) AS discount,
        COALESCE(o.cost, 0) AS cost,
        (COALESCE(o.sales, 0) - COALESCE(r.return_value, 0) - COALESCE(d.discount_total, 0)) - COALESCE(o.cost, 0) AS profit
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

  // ✅ simple CSV converter
  toCSV(rows) {
    if (!rows || rows.length === 0) return "No data\n";
    const headers = Object.keys(rows[0]);
    const escape = (v) => {
      const s = String(v ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const lines = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
    ];
    return lines.join("\n") + "\n";
  }

  async returnAnalytics(owner_id, { start, end }) {
    const startDate = parseDateOrNull(start);
    const endDate = parseDateOrNull(end);

    const startFinal = startDate
      ? startOfDay(startDate)
      : startOfDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    const endFinal = endDate ? endOfDay(endDate) : endOfDay(new Date());

    const summaryRows = await prisma.$queryRaw`
    SELECT
      COUNT(DISTINCT ccr.return_id)::int AS total_returns,
      COALESCE(SUM(ccri.qty), 0)::int AS total_qty,
      COALESCE(SUM(CASE WHEN LOWER(ccri.condition) = 'damaged' THEN ccri.qty ELSE 0 END), 0)::int AS damaged_qty,
      COALESCE(SUM(CASE WHEN LOWER(ccri.condition) = 'good' THEN ccri.qty ELSE 0 END), 0)::int AS good_qty,
      COALESCE(SUM(csi.sp * ccri.qty), 0)::numeric AS return_value
    FROM clothing_customer_return_items ccri
    JOIN clothing_customer_returns ccr
      ON ccr.return_id = ccri.return_id
    LEFT JOIN clothing_sales_items csi
      ON csi.sales_item_id = ccri.sales_item_id
    WHERE ccr.owner_id = ${owner_id}
      AND ccr.created_at >= ${startFinal}
      AND ccr.created_at <= ${endFinal};
  `;

    const conditionRows = await prisma.$queryRaw`
    SELECT
      LOWER(ccri.condition) AS condition,
      COALESCE(SUM(ccri.qty), 0)::int AS qty
    FROM clothing_customer_return_items ccri
    JOIN clothing_customer_returns ccr
      ON ccr.return_id = ccri.return_id
    WHERE ccr.owner_id = ${owner_id}
      AND ccr.created_at >= ${startFinal}
      AND ccr.created_at <= ${endFinal}
    GROUP BY LOWER(ccri.condition)
    ORDER BY qty DESC;
  `;

    const productRows = await prisma.$queryRaw`
    SELECT
      p.product_id,
      p.product_name,
      COALESCE(SUM(ccri.qty), 0)::int AS total_qty,
      COALESCE(SUM(CASE WHEN LOWER(ccri.condition) = 'damaged' THEN ccri.qty ELSE 0 END), 0)::int AS damaged_qty,
      COALESCE(SUM(CASE WHEN LOWER(ccri.condition) = 'good' THEN ccri.qty ELSE 0 END), 0)::int AS good_qty,
      COALESCE(SUM(csi.sp * ccri.qty), 0)::numeric AS return_value
    FROM clothing_customer_return_items ccri
    JOIN clothing_customer_returns ccr
      ON ccr.return_id = ccri.return_id
    LEFT JOIN clothing_sales_items csi
      ON csi.sales_item_id = ccri.sales_item_id
    LEFT JOIN clothing_products p
      ON p.product_id = csi.product_id
    WHERE ccr.owner_id = ${owner_id}
      AND ccr.created_at >= ${startFinal}
      AND ccr.created_at <= ${endFinal}
    GROUP BY p.product_id, p.product_name
    ORDER BY total_qty DESC, damaged_qty DESC
    LIMIT 10;
  `;

    const s = summaryRows[0] || {};

    return {
      summary: {
        total_returns: Number(s.total_returns || 0),
        total_qty: Number(s.total_qty || 0),
        damaged_qty: Number(s.damaged_qty || 0),
        good_qty: Number(s.good_qty || 0),
        return_value: Number(s.return_value || 0),
      },
      by_condition: conditionRows.map((x) => ({
        condition: x.condition || "unknown",
        qty: Number(x.qty || 0),
      })),
      top_products: productRows.map((x) => ({
        product_id: x.product_id,
        product_name: x.product_name || "Unknown Product",
        total_qty: Number(x.total_qty || 0),
        damaged_qty: Number(x.damaged_qty || 0),
        good_qty: Number(x.good_qty || 0),
        return_value: Number(x.return_value || 0),
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

export default new ClothingReportService();
