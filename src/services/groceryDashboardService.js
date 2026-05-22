// src/services/groceryDashboardService.js
import prisma from "../config/prisma.js";

class GroceryDashboardService {
  async getDashboard(owner_id) {
    const now = new Date();

    // Today: 00:00:00 to now
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // This Month: First day of month 00:00:00 to now
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Last 7 days: 7 days ago 00:00:00 to now
    const last7DaysStart = new Date(now);
    last7DaysStart.setDate(last7DaysStart.getDate() - 6); // 6 days ago + today = 7 days
    last7DaysStart.setHours(0, 0, 0, 0);

    // All Time: No filter

    const [today, thisMonth, allTime, salesReport] = await Promise.all([
      this.getStats(owner_id, todayStart, now),
      this.getStats(owner_id, monthStart, now),
      this.getStats(owner_id, null, null),
      this.getSalesReport(owner_id, last7DaysStart, now),
    ]);

    return {
      today,
      this_month: thisMonth,
      all_time: allTime,
      sales_report: salesReport,
    };
  }

  async getStats(owner_id, startDate, endDate) {
    const dateFilter = startDate && endDate
      ? { gte: startDate, lte: endDate }
      : undefined;

    // 1) Sales Stats
    const salesAgg = await prisma.grocerySales.aggregate({
      where: {
        owner_id,
        ...(dateFilter && { created_at: dateFilter }),
      },
      _sum: {
        total_amount: true,
        paid_amount: true,
      },
      _count: { sales_id: true },
    });

    const totalSales = Number(salesAgg._sum.total_amount || 0);
    const totalPaid = Number(salesAgg._sum.paid_amount || 0);
    const creditRemaining = Math.max(0, totalSales - totalPaid);
    const salesCount = Number(salesAgg._count.sales_id || 0);

    // 2) Profit Calculation (Revenue - Cost)
    // Cost = sum(cp * qty) for all sold items
    const salesItems = await prisma.grocerySalesItem.findMany({
      where: {
        sales: {
          owner_id,
          ...(dateFilter && { created_at: dateFilter }),
        },
      },
      select: {
        qty: true,
        cp: true,
        sp: true,
      },
    });

    let totalCost = 0;
    let totalRevenue = 0;

    salesItems.forEach((item) => {
      const qty = Number(item.qty);
      const cp = Number(item.cp);
      const sp = Number(item.sp);
      totalCost += cp * qty;
      totalRevenue += sp * qty;
    });

    const profit = totalRevenue - totalCost;

    // 3) Product Count (All Time only, not filtered by date)
    const productCount = dateFilter
      ? null
      : await prisma.groceryProduct.count({ where: { owner_id } });

    return {
      sales: {
        total_amount: totalSales,
        paid_amount: totalPaid,
        credit_remaining: creditRemaining,
        count: salesCount,
      },
      profit: {
        total_revenue: totalRevenue,
        total_cost: totalCost,
        profit: profit,
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

    // Query grouped by day
    const rows = await prisma.$queryRaw`
      WITH sales_items AS (
        SELECT
          date_trunc('day', gs.created_at) AS period,
          SUM(gsi.line_total)::numeric AS gross_sales,
          SUM((gsi.cp * gsi.qty))::numeric AS cost,
          SUM((gsi.sp * gsi.qty))::numeric AS sales_value
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
          SUM((gsi.sp * gcri.qty))::numeric AS return_value,
          SUM(COALESCE(gcr.refund_amount, 0))::numeric AS refund_total
        FROM grocery_customer_return_items gcri
        JOIN grocery_customer_returns gcr ON gcr.return_id = gcri.return_id
        LEFT JOIN grocery_sales_items gsi ON gsi.sales_item_id = gcri.sales_item_id
        WHERE gcr.owner_id = ${owner_id}
          AND gcr.created_at >= ${startFinal}
          AND gcr.created_at <= ${endFinal}
        GROUP BY 1
      )
      SELECT
        COALESCE(si.period, p.period, r.period) AS period,
        COALESCE(si.gross_sales, 0) - COALESCE(r.return_value, 0) AS sales,
        COALESCE(si.cost, 0) AS cost,
        (COALESCE(si.gross_sales, 0) - COALESCE(r.return_value, 0)) - COALESCE(si.cost, 0) AS profit,
        COALESCE(p.paid_total, 0) AS paid,
        COALESCE(r.refund_total, 0) AS refund_total
      FROM sales_items si
      FULL OUTER JOIN paid p ON p.period = si.period
      FULL OUTER JOIN returns r ON r.period = COALESCE(si.period, p.period)
      ORDER BY period ASC;
    `;

    return rows.map((r) => {
      const sales = Number(r.sales || 0);
      const cost = Number(r.cost || 0);
      const paid = Number(r.paid || 0);
      const refund = Number(r.refund_total || 0);
      const due = sales - paid - refund;
      return {
        period: new Date(r.period).toISOString(),
        sales,
        cost,
        paid,
        profit: Number(r.profit || 0),
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
      activities.push({
        type: "STOCK_OUT",
        created_at: s.created_at,
        title: "Sale (stock out)",
        message: `Bill ${s.sales_id} • Total ${Number(s.total_amount)} • Paid ${Number(s.paid_amount)} • ${s.payment_status}`,
        ref: { sales_id: s.sales_id },
      });
    }

    for (const r of custReturns) {
      activities.push({
        type: "CUSTOMER_RETURN",
        created_at: r.created_at,
        title: "Customer return",
        message: `Return ${r.return_id} • Sale ${r.sales_id || "-"} • Refund ${Number(r.refund_amount || 0)}`,
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
