// src/services/storeDashboardService.js
import { prisma } from "../prisma/client.js";
import storeStockAlertService from "./storeStockAlertService.js";

const NPT_OFFSET_MS = 5 * 60 * 60 * 1000 + 45 * 60 * 1000; // UTC+5:45

function nowNPT() {
  const nowUTC = new Date();
  return new Date(nowUTC.getTime() + NPT_OFFSET_MS);
}

function todayStartUTC() {
  const npt = nowNPT();
  return new Date(
    Date.UTC(npt.getUTCFullYear(), npt.getUTCMonth(), npt.getUTCDate(), 0, 0, 0, 0) - NPT_OFFSET_MS
  );
}

function monthStartUTC() {
  const npt = nowNPT();
  return new Date(
    Date.UTC(npt.getUTCFullYear(), npt.getUTCMonth(), 1, 0, 0, 0, 0) - NPT_OFFSET_MS
  );
}

function daysAgoStartUTC(days) {
  const npt = nowNPT();
  const d = new Date(npt.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0) - NPT_OFFSET_MS
  );
}

class StoreDashboardService {
  // async getDashboard(owner_id) {
  //   const nowUTC = new Date();
  //   const todayStart  = todayStartUTC();
  //   const monthStart  = monthStartUTC();
  //   const last7Start  = daysAgoStartUTC(7);

  //   const [today, thisMonth, allTime, salesChart, recentActivities, lowStockItems] =
  //     await Promise.all([
  //       this._getStats(owner_id, todayStart, nowUTC),
  //       this._getStats(owner_id, monthStart, nowUTC),
  //       this._getStats(owner_id, null, null),
  //       this._getSalesChart(owner_id, last7Start, nowUTC),
  //       this._getRecentActivities(owner_id, 6),
  //       this.getLowStockItems(owner_id, 40,5),
  //     ]);

  //   return {
  //     today,
  //     this_month: thisMonth,
  //     all_time: allTime,
  //     sales_chart: salesChart,
  //     recent_activities: recentActivities,
  //     low_stock_items: lowStockItems,
  //   };
  // }

  // async _getStats(owner_id, startDate, endDate) {
  //   const hasDate = startDate && endDate;

  //   // Sales header totals
  //   const salesRows = hasDate
  //     ? await prisma.$queryRaw`
  //         SELECT
  //           COALESCE(SUM(total_amount), 0)::numeric           AS total_amount,
  //           COALESCE(SUM(discount), 0)::numeric               AS total_discount,
  //           COALESCE(SUM(paid_amount), 0)::numeric            AS total_paid,
  //           COALESCE(SUM(due_amount), 0)::numeric             AS total_due,
  //           COALESCE(SUM(GREATEST(total_amount - COALESCE(discount,0),0)),0)::numeric AS effective_total,
  //           COUNT(sales_id)::int                              AS sales_count
  //         FROM store_sales
  //         WHERE owner_id = ${owner_id}
  //           AND created_at >= ${startDate}
  //           AND created_at <= ${endDate}
  //       `
  //     : await prisma.$queryRaw`
  //         SELECT
  //           COALESCE(SUM(total_amount), 0)::numeric           AS total_amount,
  //           COALESCE(SUM(discount), 0)::numeric               AS total_discount,
  //           COALESCE(SUM(paid_amount), 0)::numeric            AS total_paid,
  //           COALESCE(SUM(due_amount), 0)::numeric             AS total_due,
  //           COALESCE(SUM(GREATEST(total_amount - COALESCE(discount,0),0)),0)::numeric AS effective_total,
  //           COUNT(sales_id)::int                              AS sales_count
  //         FROM store_sales
  //         WHERE owner_id = ${owner_id}
  //       `;

  //   const sr = salesRows[0] || {};

  //   // Profit calculation
  //   const profitRows = hasDate
  //     ? await prisma.$queryRaw`
  //         WITH sold AS (
  //           SELECT
  //             ss.sales_id,
  //             GREATEST(ss.total_amount - COALESCE(ss.discount, 0), 0) AS effective_total,
  //             COALESCE(SUM(COALESCE(ssi.cp, 0) * ssi.qty), 0)         AS sold_cost
  //           FROM store_sales_items ssi
  //           JOIN store_sales ss ON ss.sales_id = ssi.sales_id
  //           WHERE ss.owner_id = ${owner_id}
  //             AND ss.created_at >= ${startDate}
  //             AND ss.created_at <= ${endDate}
  //           GROUP BY ss.sales_id, ss.total_amount, ss.discount
  //         ),
  //         returns AS (
  //           SELECT
  //             scr.sales_id,
  //             COALESCE(SUM(scr.refund_amount), 0)               AS total_refund,
  //             COALESCE(SUM(COALESCE(ssi.cp, 0) * scri.qty), 0) AS returned_cost
  //           FROM store_customer_returns scr
  //           INNER JOIN sold s ON s.sales_id = scr.sales_id
  //           LEFT JOIN store_customer_return_items scri ON scri.return_id = scr.return_id
  //           LEFT JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
  //           WHERE scr.owner_id = ${owner_id}
  //           GROUP BY scr.sales_id
  //         )
  //         SELECT
  //           COALESCE(SUM(s.effective_total), 0) - COALESCE(SUM(r.total_refund), 0)  AS actual_revenue,
  //           COALESCE(SUM(s.sold_cost), 0)       - COALESCE(SUM(r.returned_cost), 0) AS net_cost,
  //           COALESCE(SUM(r.total_refund), 0)                                         AS total_refund
  //         FROM sold s
  //         LEFT JOIN returns r ON r.sales_id = s.sales_id
  //       `
  //     : await prisma.$queryRaw`
  //         WITH sold AS (
  //           SELECT
  //             ss.sales_id,
  //             GREATEST(ss.total_amount - COALESCE(ss.discount, 0), 0) AS effective_total,
  //             COALESCE(SUM(COALESCE(ssi.cp, 0) * ssi.qty), 0)         AS sold_cost
  //           FROM store_sales_items ssi
  //           JOIN store_sales ss ON ss.sales_id = ssi.sales_id
  //           WHERE ss.owner_id = ${owner_id}
  //           GROUP BY ss.sales_id, ss.total_amount, ss.discount
  //         ),
  //         returns AS (
  //           SELECT
  //             scr.sales_id,
  //             COALESCE(SUM(scr.refund_amount), 0)               AS total_refund,
  //             COALESCE(SUM(COALESCE(ssi.cp, 0) * scri.qty), 0) AS returned_cost
  //           FROM store_customer_returns scr
  //           INNER JOIN sold s ON s.sales_id = scr.sales_id
  //           LEFT JOIN store_customer_return_items scri ON scri.return_id = scr.return_id
  //           LEFT JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
  //           WHERE scr.owner_id = ${owner_id}
  //           GROUP BY scr.sales_id
  //         )
  //         SELECT
  //           COALESCE(SUM(s.effective_total), 0) - COALESCE(SUM(r.total_refund), 0)  AS actual_revenue,
  //           COALESCE(SUM(s.sold_cost), 0)       - COALESCE(SUM(r.returned_cost), 0) AS net_cost,
  //           COALESCE(SUM(r.total_refund), 0)                                         AS total_refund
  //         FROM sold s
  //         LEFT JOIN returns r ON r.sales_id = s.sales_id
  //       `;

  //   // Expenses
  //   const expenseRows = hasDate
  //     ? await prisma.$queryRaw`
  //         SELECT COALESCE(SUM(amount), 0)::numeric AS total_expenses
  //         FROM store_expenses
  //         WHERE owner_id = ${owner_id}
  //           AND created_at >= ${startDate}
  //           AND created_at <= ${endDate}
  //       `
  //     : await prisma.$queryRaw`
  //         SELECT COALESCE(SUM(amount), 0)::numeric AS total_expenses
  //         FROM store_expenses
  //         WHERE owner_id = ${owner_id}
  //       `;

  //   const pr = profitRows[0] || {};
  //   const actualRevenue  = Number(pr.actual_revenue || 0);
  //   const netCost        = Number(pr.net_cost       || 0);
  //   const totalRefund    = Number(pr.total_refund   || 0);
  //   const totalExpenses  = Number(expenseRows[0]?.total_expenses || 0);

  //   const productCount = await prisma.storeProduct.count({ where: { owner_id } });
  //   const itemCount    = await prisma.storeProduct.count({ where: { owner_id, type: "item" } });
  //   const serviceCount = await prisma.storeProduct.count({ where: { owner_id, type: "service" } });

  //   return {
  //     sales: {
  //       total_amount:    Number(sr.total_amount   || 0),
  //       total_discount:  Number(sr.total_discount || 0),
  //       effective_total: actualRevenue,
  //       paid_amount:     Number(sr.total_paid     || 0),
  //       due_amount:      Number(sr.total_due      || 0),
  //       total_refund:    totalRefund,
  //       count:           Number(sr.sales_count    || 0),
  //     },
  //     profit: {
  //       actual_revenue:  actualRevenue,
  //       total_cost:      netCost,
  //       total_expenses:  totalExpenses,
  //       profit:          actualRevenue - netCost - totalExpenses,  // ← expenses deducted
  //     },
  //     products: {
  //       total:    productCount,
  //       items:    itemCount,
  //       services: serviceCount,
  //     },
  //   };
  // }
  async getDashboard(owner_id) {
    const nowUTC = new Date();
    const todayStart  = todayStartUTC();
    const monthStart  = monthStartUTC();
    const last7Start  = daysAgoStartUTC(7);

    const [productCounts, today, thisMonth, allTime, salesChart, recentActivities, lowStockItems] =
      await Promise.all([
        this._getProductCounts(owner_id),
        this._getStats(owner_id, todayStart, nowUTC),
        this._getStats(owner_id, monthStart, nowUTC),
        this._getStats(owner_id, null, null),
        this._getSalesChart(owner_id, last7Start, nowUTC),
        this._getRecentActivities(owner_id, 6),
        this.getLowStockItems(owner_id, 40, 5),
      ]);

    return {
      today:       { ...today,     products: productCounts },
      this_month:  { ...thisMonth, products: productCounts },
      all_time:    { ...allTime,   products: productCounts },
      sales_chart: salesChart,
      recent_activities: recentActivities,
      low_stock_items: lowStockItems,
    };
  }

  async _getProductCounts(owner_id) {
    const rows = await prisma.$queryRaw`
      SELECT
        COUNT(*)::int                                       AS total,
        COUNT(CASE WHEN type = 'item' THEN 1 END)::int       AS items,
        COUNT(CASE WHEN type = 'service' THEN 1 END)::int    AS services
      FROM store_products
      WHERE owner_id = ${owner_id}
    `;
    const r = rows[0] || {};
    return {
      total:    Number(r.total    || 0),
      items:    Number(r.items    || 0),
      services: Number(r.services || 0),
    };
  }

  async _getStats(owner_id, startDate, endDate) {
    const hasDate = startDate && endDate;

    const rows = hasDate
      ? await prisma.$queryRaw`
          WITH sales_in_period AS (
            SELECT sales_id
            FROM store_sales
            WHERE owner_id = ${owner_id}
              AND created_at >= ${startDate}
              AND created_at <= ${endDate}
          ),
          sales_totals AS (
            SELECT
              COALESCE(SUM(total_amount), 0)::numeric AS total_amount,
              COALESCE(SUM(discount), 0)::numeric      AS total_discount,
              COALESCE(SUM(paid_amount), 0)::numeric   AS total_paid,
              COALESCE(SUM(due_amount), 0)::numeric    AS total_due,
              COUNT(sales_id)::int                     AS sales_count
            FROM store_sales
            WHERE owner_id = ${owner_id}
              AND created_at >= ${startDate}
              AND created_at <= ${endDate}
          ),
          sold AS (
            SELECT
              ss.sales_id,
              GREATEST(ss.total_amount - COALESCE(ss.discount, 0), 0) AS effective_total,
              COALESCE(SUM(COALESCE(ssi.cp, 0) * ssi.qty), 0)         AS sold_cost
            FROM store_sales_items ssi
            JOIN sales_in_period sip ON sip.sales_id = ssi.sales_id
            JOIN store_sales ss ON ss.sales_id = ssi.sales_id
            GROUP BY ss.sales_id, ss.total_amount, ss.discount
          ),
          returns AS (
            SELECT
              r_refund.sales_id,
              COALESCE(r_refund.total_refund, 0) AS total_refund,
              COALESCE(r_cost.returned_cost, 0) AS returned_cost
            FROM (
              SELECT scr.sales_id, SUM(scr.refund_amount) AS total_refund
              FROM store_customer_returns scr
              INNER JOIN sold s ON s.sales_id = scr.sales_id
              WHERE scr.owner_id = ${owner_id}
              GROUP BY scr.sales_id
            ) r_refund
            LEFT JOIN (
              SELECT scr.sales_id, SUM(COALESCE(ssi.cp, 0) * scri.qty) AS returned_cost
              FROM store_customer_returns scr
              INNER JOIN sold s ON s.sales_id = scr.sales_id
              JOIN store_customer_return_items scri ON scri.return_id = scr.return_id
              JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
              WHERE scr.owner_id = ${owner_id}
              GROUP BY scr.sales_id
            ) r_cost ON r_cost.sales_id = r_refund.sales_id
          ),
          profit_calc AS (
            SELECT
              COALESCE(SUM(s.effective_total), 0) - COALESCE(SUM(r.total_refund), 0)  AS actual_revenue,
              COALESCE(SUM(s.sold_cost), 0)       - COALESCE(SUM(r.returned_cost), 0) AS net_cost,
              COALESCE(SUM(r.total_refund), 0)                                        AS total_refund
            FROM sold s
            LEFT JOIN returns r ON r.sales_id = s.sales_id
          ),
          expense_totals AS (
            SELECT COALESCE(SUM(amount), 0)::numeric AS total_expenses
            FROM store_expenses
            WHERE owner_id = ${owner_id}
              AND created_at >= ${startDate}
              AND created_at <= ${endDate}
          )
          SELECT * FROM sales_totals, profit_calc, expense_totals
        `
      : await prisma.$queryRaw`
          WITH sold AS (
            SELECT
              ss.sales_id,
              GREATEST(ss.total_amount - COALESCE(ss.discount, 0), 0) AS effective_total,
              COALESCE(SUM(COALESCE(ssi.cp, 0) * ssi.qty), 0)         AS sold_cost
            FROM store_sales_items ssi
            JOIN store_sales ss ON ss.sales_id = ssi.sales_id
            WHERE ss.owner_id = ${owner_id}
            GROUP BY ss.sales_id, ss.total_amount, ss.discount
          ),
          returns AS (
            SELECT
              r_refund.sales_id,
              COALESCE(r_refund.total_refund, 0) AS total_refund,
              COALESCE(r_cost.returned_cost, 0) AS returned_cost
            FROM (
              SELECT scr.sales_id, SUM(scr.refund_amount) AS total_refund
              FROM store_customer_returns scr
              INNER JOIN sold s ON s.sales_id = scr.sales_id
              WHERE scr.owner_id = ${owner_id}
              GROUP BY scr.sales_id
            ) r_refund
            LEFT JOIN (
              SELECT scr.sales_id, SUM(COALESCE(ssi.cp, 0) * scri.qty) AS returned_cost
              FROM store_customer_returns scr
              INNER JOIN sold s ON s.sales_id = scr.sales_id
              JOIN store_customer_return_items scri ON scri.return_id = scr.return_id
              JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
              WHERE scr.owner_id = ${owner_id}
              GROUP BY scr.sales_id
            ) r_cost ON r_cost.sales_id = r_refund.sales_id
          ),
          profit_calc AS (
            SELECT
              COALESCE(SUM(s.effective_total), 0) - COALESCE(SUM(r.total_refund), 0)  AS actual_revenue,
              COALESCE(SUM(s.sold_cost), 0)       - COALESCE(SUM(r.returned_cost), 0) AS net_cost,
              COALESCE(SUM(r.total_refund), 0)                                        AS total_refund
            FROM sold s
            LEFT JOIN returns r ON r.sales_id = s.sales_id
          ),
          sales_totals AS (
            SELECT
              COALESCE(SUM(total_amount), 0)::numeric AS total_amount,
              COALESCE(SUM(discount), 0)::numeric      AS total_discount,
              COALESCE(SUM(paid_amount), 0)::numeric   AS total_paid,
              COALESCE(SUM(due_amount), 0)::numeric    AS total_due,
              COUNT(sales_id)::int                     AS sales_count
            FROM store_sales
            WHERE owner_id = ${owner_id}
          ),
          expense_totals AS (
            SELECT COALESCE(SUM(amount), 0)::numeric AS total_expenses
            FROM store_expenses
            WHERE owner_id = ${owner_id}
          )
          SELECT * FROM sales_totals, profit_calc, expense_totals
        `;

    const row = rows[0] || {};
    const actualRevenue = Number(row.actual_revenue  || 0);
    const netCost       = Number(row.net_cost        || 0);
    const totalRefund   = Number(row.total_refund    || 0);
    const totalExpenses = Number(row.total_expenses  || 0);

    return {
      sales: {
        total_amount:    Number(row.total_amount   || 0),
        total_discount:  Number(row.total_discount || 0),
        effective_total: actualRevenue,
        paid_amount:     Number(row.total_paid     || 0),
        due_amount:      Number(row.total_due      || 0),
        total_refund:    totalRefund,
        count:           Number(row.sales_count    || 0),
      },
      profit: {
        actual_revenue: actualRevenue,
        total_cost:     netCost,
        total_expenses: totalExpenses,
        profit:         actualRevenue - netCost - totalExpenses,
      },
    };
  }


  

  
  async _getSalesChart(owner_id, startDate, endDate) {
    const rows = await prisma.$queryRaw`
      WITH sales_with_effective AS (
        SELECT
          date_trunc('day', ss.created_at) AS period,
          ss.sales_id,
          GREATEST(ss.total_amount - COALESCE(ss.discount, 0), 0) AS effective_total,
          ss.paid_amount
        FROM store_sales ss
        WHERE ss.owner_id = ${owner_id}
          AND ss.created_at >= ${startDate}
          AND ss.created_at <= ${endDate}
      ),
      returns_per_sale AS (
        SELECT
          r_refund.sales_id,
          COALESCE(r_refund.total_refund, 0)::numeric AS refund_total,
          COALESCE(r_cost.returned_cost, 0)::numeric AS returned_cost
        FROM (
          SELECT sales_id, SUM(refund_amount) AS total_refund
          FROM store_customer_returns
          WHERE owner_id = ${owner_id}
            AND created_at >= ${startDate}
            AND created_at <= ${endDate}
          GROUP BY sales_id
        ) r_refund
        LEFT JOIN (
          SELECT scr.sales_id, SUM(COALESCE(ssi.cp, 0) * scri.qty) AS returned_cost
          FROM store_customer_returns scr
          JOIN store_customer_return_items scri ON scri.return_id = scri.return_id
          JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
          WHERE scr.owner_id = ${owner_id}
            AND scr.created_at >= ${startDate}
            AND scr.created_at <= ${endDate}
          GROUP BY scr.sales_id
        ) r_cost ON r_cost.sales_id = r_refund.sales_id
      ),
      per_sale AS (
        SELECT
          s.period,
          s.sales_id,
          s.effective_total,
          s.paid_amount,
          COALESCE(r.refund_total, 0) AS refund_total,
          COALESCE(r.returned_cost, 0) AS returned_cost,
          GREATEST(0,
            s.paid_amount - GREATEST(0,
              COALESCE(r.refund_total, 0) - GREATEST(0, s.effective_total - s.paid_amount)
            )
          )::numeric AS net_paid
        FROM sales_with_effective s
        LEFT JOIN returns_per_sale r ON r.sales_id = s.sales_id
      ),
      cost_grouped AS (
        SELECT
          date_trunc('day', ss.created_at) AS period,
          SUM(COALESCE(ssi.cp, 0) * ssi.qty)::numeric AS cost
        FROM store_sales_items ssi
        JOIN store_sales ss ON ss.sales_id = ssi.sales_id
        WHERE ss.owner_id = ${owner_id}
          AND ss.created_at >= ${startDate}
          AND ss.created_at <= ${endDate}
        GROUP BY 1
      )
      SELECT
        ps.period,
        SUM(ps.effective_total)::numeric AS effective_sales,
        SUM(ps.refund_total)::numeric AS refund_total,
        SUM(ps.returned_cost)::numeric AS returned_cost,
        SUM(ps.net_paid)::numeric AS net_paid,
        COALESCE(MAX(cg.cost), 0)::numeric AS cost
      FROM per_sale ps
      LEFT JOIN cost_grouped cg ON cg.period = ps.period
      GROUP BY ps.period
      ORDER BY ps.period ASC;
    `;

    return rows.map((r) => {
      const effectiveSales = Number(r.effective_sales || 0);
      const refund = Number(r.refund_total || 0);
      const returnedCost = Number(r.returned_cost || 0);
      const revenue = effectiveSales - refund;
      const cost = Number(r.cost || 0) - returnedCost;
      const netPaid = Number(r.net_paid || 0);
      const profit = revenue - cost;

      return {
        period: new Date(r.period).toISOString(),
        sales: revenue,
        cost,
        paid: netPaid,
        refund,
        profit,
      };
    });
  }

  async _getRecentActivities(owner_id, limit = 6) {
    const per = Math.max(10, limit * 3);

    const [products, lots, sales, returns] = await Promise.all([
      prisma.storeProduct.findMany({
        where: { owner_id },
        orderBy: { created_at: "desc" },
        take: per,
        select: {
          product_id: true, product_name: true, type: true, created_at: true,
          category: { select: { category_name: true } },
        },
      }),
      prisma.storeStockLot.findMany({
        where: { owner_id },
        orderBy: { created_at: "desc" },
        take: per,
        select: {
          lot_id: true, qty_in: true, created_at: true,
          product: { select: { product_id: true, product_name: true, unit: { select: { unit_name: true } } } },
          supplier: { select: { supplier_name: true } },
        },
      }),
      prisma.storeSales.findMany({
        where: { owner_id },
        orderBy: { created_at: "desc" },
        take: per,
        select: {
          sales_id: true, total_amount: true, discount: true,
          paid_amount: true, payment_status: true, created_at: true,
          customer: { select: { full_name: true, phone: true } },
        },
      }),
      prisma.storeCustomerReturn.findMany({
        where: { owner_id },
        orderBy: { created_at: "desc" },
        take: per,
        select: {
          return_id: true, sales_id: true, refund_amount: true, created_at: true,
          sales: { select: { customer: { select: { full_name: true } } } },
        },
      }),
    ]);

    const activities = [];

    for (const p of products) {
      activities.push({
        type: "PRODUCT_CREATED",
        created_at: p.created_at,
        title: "Product added",
        message: `${p.product_name} (${p.type})${p.category ? " • " + p.category.category_name : ""}`,
        ref: { product_id: p.product_id },
      });
    }

    for (const l of lots) {
      const unit = l.product?.unit?.unit_name || "units";
      activities.push({
        type: "STOCK_IN",
        created_at: l.created_at,
        title: "Stock in",
        message: `${l.product?.product_name || "Product"} • +${l.qty_in} ${unit}${l.supplier ? " • " + l.supplier.supplier_name : ""}`,
        ref: { lot_id: l.lot_id, product_id: l.product?.product_id },
      });
    }

    for (const s of sales) {
      const effectiveTotal = Number(s.total_amount) - Number(s.discount || 0);
      const customer = s.customer?.full_name || "Walk-in";
      const disc = Number(s.discount || 0);
      activities.push({
        type: "SALE",
        created_at: s.created_at,
        title: "Sale",
        message: `${customer} • Rs.${effectiveTotal}${disc > 0 ? ` (Disc: ${disc})` : ""} • ${s.payment_status}`,
        ref: { sales_id: s.sales_id },
      });
    }

    for (const r of returns) {
      const customer = r.sales?.customer?.full_name || "Customer";
      activities.push({
        type: "CUSTOMER_RETURN",
        created_at: r.created_at,
        title: "Customer return",
        message: `${customer} • Refund Rs.${Number(r.refund_amount || 0)}`,
        ref: { return_id: r.return_id, sales_id: r.sales_id },
      });
    }

    activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return activities.slice(0, limit);
  }

  async getLowStockItems(owner_id, threshold = 40, limit = 10) {
    // Use the stock alerts service with the provided threshold
    const result = await storeStockAlertService.getStockAlerts(owner_id, {
      lowThreshold: threshold,
      criticalThreshold: Math.floor(threshold / 2),
    });

    if (!result.success) {
      return {
        summary: {
          total_products: 0,
          in_stock: 0,
          low_stock: 0,
          out_of_stock: 0,
        },
        low_stock_items: [],
        out_of_stock_items: [],
      };
    }

    const { summary, low_stock, out_of_stock } = result.data;

    // Calculate total products and in-stock count
    const totalProducts = await prisma.$queryRaw`
      SELECT COUNT(p.product_id)::int AS total
      FROM store_products p
      WHERE p.owner_id = ${owner_id} AND p.type = 'item'
    `;

    const totalCount = Number(totalProducts[0]?.total || 0);
    const lowStockCount = summary.low_stock_count + summary.critical_stock_count;
    const outOfStockCount = summary.out_of_stock_count;
    const inStockCount = totalCount - lowStockCount - outOfStockCount;

    // Map to dashboard format (simplified, just the first 'limit' items)
    const mapItem = (item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      unit: item.unit || 'units',
      category: item.category || null,
      qty_remaining: item.qty_remaining || 0,
    });

    return {
      summary: {
        total_products: totalCount,
        in_stock: Math.max(0, inStockCount),
        low_stock: lowStockCount,
        out_of_stock: outOfStockCount,
      },
      low_stock_items: low_stock.slice(0, limit).map(mapItem),
      out_of_stock_items: out_of_stock.slice(0, limit).map(mapItem),
    };
  }
  async getInventoryValue(owner_id) {
    const rows = await prisma.$queryRaw`
      SELECT
        COALESCE(SUM(qty_remaining), 0)::int                    AS total_qty,
        COALESCE(SUM(cp::numeric * qty_remaining), 0)::numeric  AS total_cost_value
      FROM store_stock_lots
      WHERE owner_id = ${owner_id}
        AND qty_remaining > 0
    `;

    const r = rows[0] || {};
    return {
      total_qty_remaining: Number(r.total_qty || 0),
      total_cost_value:    Number(Number(r.total_cost_value || 0).toFixed(2)),
    };
  }
  

  async getRecentActivities(owner_id, limit = 6) {
    return this._getRecentActivities(owner_id, limit);
  }
}
export default new StoreDashboardService();
