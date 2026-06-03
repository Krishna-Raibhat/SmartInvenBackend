// src/services/groceryDashboardService.js
import prisma from "../config/prisma.js";

class GroceryDashboardService {
  async getDashboard(owner_id) {
    const nowUTC = new Date();
    const NPT_OFFSET_MS = 5 * 60 * 60 * 1000 + 45 * 60 * 1000; // 5h45m
    const nowNPT = new Date(nowUTC.getTime() + NPT_OFFSET_MS);

    // Today start in NPT, converted back to UTC for DB query
    const todayStartNPT = new Date(
      Date.UTC(nowNPT.getUTCFullYear(), nowNPT.getUTCMonth(), nowNPT.getUTCDate(), 0, 0, 0, 0) - NPT_OFFSET_MS
    );

    // This Month start in NPT, converted back to UTC
    const monthStartNPT = new Date(
      Date.UTC(nowNPT.getUTCFullYear(), nowNPT.getUTCMonth(), 1, 0, 0, 0, 0) - NPT_OFFSET_MS
    );

    // Last 7 days start in NPT
    const last7NPT = new Date(nowNPT.getTime() - 6 * 24 * 60 * 60 * 1000);
    const last7StartNPT = new Date(
      Date.UTC(last7NPT.getUTCFullYear(), last7NPT.getUTCMonth(), last7NPT.getUTCDate(), 0, 0, 0, 0) - NPT_OFFSET_MS
    );

    const [today, thisMonth, allTime, salesReport] = await Promise.all([
      this.getStats(owner_id, todayStartNPT, nowUTC),
      this.getStats(owner_id, monthStartNPT, nowUTC),
      this.getStats(owner_id, null, null),
      this.getSalesReport(owner_id, last7StartNPT, nowUTC),
    ]);

    return {
      today,
      this_month: thisMonth,
      all_time: allTime,
      sales_report: salesReport,
    };
  }

  async getStats(owner_id, startDate, endDate) {
    const hasDate = startDate && endDate;

    const salesTotals = hasDate
      ? await prisma.$queryRaw`
          SELECT 
            COALESCE(SUM(total_amount), 0)::numeric AS total_amount,
            COALESCE(SUM(discount), 0)::numeric AS total_discount,
            COALESCE(SUM(paid_amount), 0)::numeric AS total_paid,
            COALESCE(SUM(GREATEST(total_amount - COALESCE(discount, 0), 0)), 0)::numeric AS effective_total,
            COUNT(sales_id)::int AS sales_count
          FROM grocery_sales
          WHERE owner_id = ${owner_id}
            AND created_at >= ${startDate}
            AND created_at <= ${endDate}
        `
      : await prisma.$queryRaw`
          SELECT 
            COALESCE(SUM(total_amount), 0)::numeric AS total_amount,
            COALESCE(SUM(discount), 0)::numeric AS total_discount,
            COALESCE(SUM(paid_amount), 0)::numeric AS total_paid,
            COALESCE(SUM(GREATEST(total_amount - COALESCE(discount, 0), 0)), 0)::numeric AS effective_total,
            COUNT(sales_id)::int AS sales_count
          FROM grocery_sales
          WHERE owner_id = ${owner_id}
        `;

    const row = salesTotals[0];
    const totalSales = Number(row.total_amount || 0);
    const totalDiscount = Number(row.total_discount || 0);
    const totalPaid = Number(row.total_paid || 0);
    const effectiveTotal = Number(row.effective_total || 0);
    const salesCount = Number(row.sales_count || 0);

    const profitRows = hasDate
      ? await prisma.$queryRaw`
          WITH sold AS (
            SELECT
              gs.sales_id,
              GREATEST(gs.total_amount - COALESCE(gs.discount, 0), 0) AS effective_total,
              COALESCE(SUM(gsi.cp * gsi.qty), 0) AS sold_cost
            FROM grocery_sales_items gsi
            JOIN grocery_sales gs ON gs.sales_id = gsi.sales_id
            WHERE gs.owner_id = ${owner_id}
              AND gs.created_at >= ${startDate}
              AND gs.created_at <= ${endDate}
            GROUP BY gs.sales_id, gs.total_amount, gs.discount
          ),
          returns AS (
            SELECT
              gcr.sales_id,
              COALESCE(SUM(gcr.refund_amount), 0) AS total_refund,
              COALESCE(SUM(gsi.cp * gcri.qty), 0) AS returned_cost
            FROM grocery_customer_returns gcr
            INNER JOIN sold s ON s.sales_id = gcr.sales_id
            LEFT JOIN grocery_customer_return_items gcri ON gcri.return_id = gcr.return_id
            LEFT JOIN grocery_sales_items gsi ON gsi.sales_item_id = gcri.sales_item_id
            WHERE gcr.owner_id = ${owner_id}
            GROUP BY gcr.sales_id
          )
          SELECT
            COALESCE(SUM(s.effective_total), 0) - COALESCE(SUM(r.total_refund), 0) AS actual_revenue,
            COALESCE(SUM(s.sold_cost), 0) - COALESCE(SUM(r.returned_cost), 0) AS net_cost
          FROM sold s
          LEFT JOIN returns r ON r.sales_id = s.sales_id
        `
      : await prisma.$queryRaw`
          WITH sold AS (
            SELECT
              gs.sales_id,
              GREATEST(gs.total_amount - COALESCE(gs.discount, 0), 0) AS effective_total,
              COALESCE(SUM(gsi.cp * gsi.qty), 0) AS sold_cost
            FROM grocery_sales_items gsi
            JOIN grocery_sales gs ON gs.sales_id = gsi.sales_id
            WHERE gs.owner_id = ${owner_id}
            GROUP BY gs.sales_id, gs.total_amount, gs.discount
          ),
          returns AS (
            SELECT
              gcr.sales_id,
              COALESCE(SUM(gcr.refund_amount), 0) AS total_refund,
              COALESCE(SUM(gsi.cp * gcri.qty), 0) AS returned_cost
            FROM grocery_customer_returns gcr
            INNER JOIN sold s ON s.sales_id = gcr.sales_id
            LEFT JOIN grocery_customer_return_items gcri ON gcri.return_id = gcr.return_id
            LEFT JOIN grocery_sales_items gsi ON gsi.sales_item_id = gcri.sales_item_id
            WHERE gcr.owner_id = ${owner_id}
            GROUP BY gcr.sales_id
          )
          SELECT
            COALESCE(SUM(s.effective_total), 0) - COALESCE(SUM(r.total_refund), 0) AS actual_revenue,
            COALESCE(SUM(s.sold_cost), 0) - COALESCE(SUM(r.returned_cost), 0) AS net_cost
          FROM sold s
          LEFT JOIN returns r ON r.sales_id = s.sales_id
        `;

    const actualRevenue = Number(profitRows?.[0]?.actual_revenue || 0);
    const netCost = Number(profitRows?.[0]?.net_cost || 0);
    const profitOrLoss = actualRevenue - netCost;

    const productCount = await prisma.groceryProduct.count({ where: { owner_id } });

    return {
      sales: {
        total_amount: totalSales,
        total_discount: totalDiscount,
        effective_total: actualRevenue,
        paid_amount: totalPaid,
        credit_remaining: Math.max(0, actualRevenue - totalPaid),
        count: salesCount,
      },
      profit: {
        actual_revenue: actualRevenue,
        total_cost: netCost,
        profit: profitOrLoss,
      },
      products: {
        count: productCount,
      },
    };
  }

  // ✅ Sales Report for Line Graph (Last 7 Days by default)
  async getSalesReport(owner_id, startDate, endDate) {
    const startFinal = startDate || startOfDay(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
    const endFinal = endDate || endOfDay(new Date());

    // Query grouped by day - matching clothing logic
    const rows = await prisma.$queryRaw`
      WITH sales_with_effective AS (
        SELECT
          date_trunc('day', gs.created_at) AS period,
          gs.sales_id,
          -- Effective total = total_amount - discount for each sale
          GREATEST(gs.total_amount - COALESCE(gs.discount, 0), 0) AS effective_total
        FROM grocery_sales gs
        WHERE gs.owner_id = ${owner_id}
          AND gs.created_at >= ${startFinal}
          AND gs.created_at <= ${endFinal}
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
          date_trunc('day', gs.created_at) AS period,
          SUM((gsi.cp * gsi.qty))::numeric AS cost
        FROM grocery_sales_items gsi
        JOIN grocery_sales gs ON gs.sales_id = gsi.sales_id
        WHERE gs.owner_id = ${owner_id}
          AND gs.created_at >= ${startFinal}
          AND gs.created_at <= ${endFinal}
        GROUP BY 1
      ),
      paid AS (
        SELECT
          date_trunc('day', created_at) AS period,
          SUM(paid_amount)::numeric AS paid_total
        FROM grocery_sales
        WHERE owner_id = ${owner_id}
          AND created_at >= ${startFinal}
          AND created_at <= ${endFinal}
        GROUP BY 1
      ),
      returns AS (
        SELECT
          date_trunc('day', gcr.created_at) AS period,
          SUM(COALESCE(gcr.refund_amount, 0))::numeric AS refund_total
        FROM grocery_customer_returns gcr
        WHERE gcr.owner_id = ${owner_id}
          AND gcr.created_at >= ${startFinal}
          AND gcr.created_at <= ${endFinal}
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

  // ✅ Recent Activities (Last 4 by default)
  async getRecentActivities(owner_id, limit = 4) {
    const lim = Number(limit);
    const take = Number.isInteger(lim) && lim > 0 && lim <= 50 ? lim : 4;

    // Fetch small sets from each source
    const per = Math.max(10, take * 4);

    const [products, lots, sales, custReturns] = await Promise.all([
      prisma.groceryProduct.findMany({
        where: { owner_id },
        orderBy: { created_at: "desc" },
        take: per,
        select: {
          product_id: true,
          product_name: true,
          created_at: true,
          category: { select: { category_name: true } },
          brand: { select: { brand_name: true } },
        },
      }),

      prisma.groceryStockLot.findMany({
        where: { owner_id },
        orderBy: { created_at: "desc" },
        take: per,
        select: {
          lot_id: true,
          product_id: true,
          qty_in: true,
          qty_remaining: true,
          created_at: true,
          product: { 
            select: { 
              product_name: true,
              unit: { select: { unit_name: true } }
            } 
          },
          supplier: { select: { supplier_name: true } },
        },
      }),

      prisma.grocerySales.findMany({
        where: { owner_id },
        orderBy: { created_at: "desc" },
        take: per,
        select: {
          sales_id: true,
          total_amount: true,
          discount: true,
          paid_amount: true,
          payment_status: true,
          created_at: true,
          customer: { select: { full_name: true, phone: true } },
        },
      }),

      prisma.groceryCustomerReturn.findMany({
        where: { owner_id },
        orderBy: { created_at: "desc" },
        take: per,
        select: {
          return_id: true,
          sales_id: true,
          refund_amount: true,
          created_at: true,
          sales: {
            select: {
              customer: {
                select: {
                  full_name: true,
                  phone: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // Normalize to a single activity format
    const activities = [];

    for (const p of products) {
      const brandCat = [p.brand?.brand_name, p.category?.category_name].filter(Boolean).join(" • ");
      activities.push({
        type: "PRODUCT_CREATED",
        created_at: p.created_at,
        title: "Product added",
        message: `${p.product_name}${brandCat ? " (" + brandCat + ")" : ""}`,
        ref: { product_id: p.product_id },
      });
    }

    for (const l of lots) {
      const unit = l.product?.unit?.unit_name || "units";
      activities.push({
        type: "STOCK_IN",
        created_at: l.created_at,
        title: "Stock in",
        message: `${l.product?.product_name || "Product"} • +${Number(l.qty_in)} ${unit} • Supplier: ${l.supplier?.supplier_name || "-"}`,
        ref: { lot_id: l.lot_id, product_id: l.product_id },
      });
    }

    for (const s of sales) {
      const discount = Number(s.discount || 0);
      const effectiveTotal = Number(s.total_amount) - discount;
      const discountMsg = discount > 0 ? ` (Disc: ${discount})` : '';
      activities.push({
        type: "STOCK_OUT",
        created_at: s.created_at,
        title: "Sale (stock out)",
        message: `Bill ${s.sales_id} • Total ${effectiveTotal}${discountMsg} • Paid ${Number(s.paid_amount)} • ${s.payment_status}`,
        ref: { sales_id: s.sales_id },
      });
    }

    for (const r of custReturns) {
      const customerName = r.sales?.customer?.full_name || "Walk-in customer";
      activities.push({
        type: "CUSTOMER_RETURN",
        created_at: r.created_at,
        title: "Customer return",
        message: `${customerName} • Bill #${r.sales_id?.slice(-8) || "-"} • Refund Rs.${Number(r.refund_amount || 0)}`,
        ref: { return_id: r.return_id, sales_id: r.sales_id },
      });
    }

    // Sort newest first and take final limit
    activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return activities.slice(0, take);
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

export default new GroceryDashboardService();
