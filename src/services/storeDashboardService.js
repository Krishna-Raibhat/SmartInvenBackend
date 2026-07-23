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

    const [statsRowResult, salesChart, recentActivities, lowStockItems] =
      await Promise.all([
        prisma.$queryRaw`
          WITH sale_metrics AS (
            SELECT
              s.created_at,
              s.total_amount,
              s.discount,
              s.paid_amount,
              s.due_amount,
              GREATEST(s.total_amount - COALESCE(s.discount, 0), 0) AS effective_total,
              COALESCE(
                (SELECT SUM(COALESCE(si.cp, 0) * si.qty) FROM store_sales_items si WHERE si.sales_id = s.sales_id),
                0
              ) AS sold_cost,
              COALESCE(
                (SELECT SUM(r.refund_amount) FROM store_customer_returns r WHERE r.sales_id = s.sales_id),
                0
              ) AS refund_amount,
              COALESCE(
                (
                  SELECT SUM(COALESCE(si.cp, 0) * ri.qty)
                  FROM store_customer_returns r
                  JOIN store_customer_return_items ri ON ri.return_id = r.return_id
                  JOIN store_sales_items si ON si.sales_item_id = ri.sales_item_id
                  WHERE r.sales_id = s.sales_id
                ),
                0
              ) AS returned_cost
            FROM store_sales s
            WHERE s.owner_id = ${owner_id}
          ),
          expense_metrics AS (
            SELECT
              COALESCE(SUM(CASE WHEN created_at >= ${todayStart} AND created_at <= ${nowUTC} THEN amount ELSE 0 END), 0)::numeric AS today_expenses,
              COALESCE(SUM(CASE WHEN created_at >= ${monthStart} AND created_at <= ${nowUTC} THEN amount ELSE 0 END), 0)::numeric AS month_expenses,
              COALESCE(SUM(amount), 0)::numeric AS all_expenses
            FROM store_expenses
            WHERE owner_id = ${owner_id}
              AND note NOT LIKE '%[SUPPLIER_PAYMENT:%'
          ),
          product_metrics AS (
            SELECT
              COUNT(*)::int                                       AS total,
              COUNT(CASE WHEN type = 'item' THEN 1 END)::int       AS items,
              COUNT(CASE WHEN type = 'service' THEN 1 END)::int    AS services
            FROM store_products
            WHERE owner_id = ${owner_id}
          ),
          sale_aggregates AS (
            SELECT
              -- Today
              COALESCE(SUM(CASE WHEN created_at >= ${todayStart} AND created_at <= ${nowUTC} THEN total_amount ELSE 0 END), 0)::numeric AS today_total_amount,
              COALESCE(SUM(CASE WHEN created_at >= ${todayStart} AND created_at <= ${nowUTC} THEN discount ELSE 0 END), 0)::numeric AS today_total_discount,
              COALESCE(SUM(CASE WHEN created_at >= ${todayStart} AND created_at <= ${nowUTC} THEN paid_amount ELSE 0 END), 0)::numeric AS today_total_paid,
              COALESCE(SUM(CASE WHEN created_at >= ${todayStart} AND created_at <= ${nowUTC} THEN due_amount ELSE 0 END), 0)::numeric AS today_total_due,
              COUNT(CASE WHEN created_at >= ${todayStart} AND created_at <= ${nowUTC} THEN 1 END)::int AS today_sales_count,
              COALESCE(SUM(CASE WHEN created_at >= ${todayStart} AND created_at <= ${nowUTC} THEN effective_total - refund_amount ELSE 0 END), 0)::numeric AS today_actual_revenue,
              COALESCE(SUM(CASE WHEN created_at >= ${todayStart} AND created_at <= ${nowUTC} THEN sold_cost - returned_cost ELSE 0 END), 0)::numeric AS today_net_cost,
              COALESCE(SUM(CASE WHEN created_at >= ${todayStart} AND created_at <= ${nowUTC} THEN refund_amount ELSE 0 END), 0)::numeric AS today_total_refund,

              -- This Month
              COALESCE(SUM(CASE WHEN created_at >= ${monthStart} AND created_at <= ${nowUTC} THEN total_amount ELSE 0 END), 0)::numeric AS month_total_amount,
              COALESCE(SUM(CASE WHEN created_at >= ${monthStart} AND created_at <= ${nowUTC} THEN discount ELSE 0 END), 0)::numeric AS month_total_discount,
              COALESCE(SUM(CASE WHEN created_at >= ${monthStart} AND created_at <= ${nowUTC} THEN paid_amount ELSE 0 END), 0)::numeric AS month_total_paid,
              COALESCE(SUM(CASE WHEN created_at >= ${monthStart} AND created_at <= ${nowUTC} THEN due_amount ELSE 0 END), 0)::numeric AS month_total_due,
              COUNT(CASE WHEN created_at >= ${monthStart} AND created_at <= ${nowUTC} THEN 1 END)::int AS month_sales_count,
              COALESCE(SUM(CASE WHEN created_at >= ${monthStart} AND created_at <= ${nowUTC} THEN effective_total - refund_amount ELSE 0 END), 0)::numeric AS month_actual_revenue,
              COALESCE(SUM(CASE WHEN created_at >= ${monthStart} AND created_at <= ${nowUTC} THEN sold_cost - returned_cost ELSE 0 END), 0)::numeric AS month_net_cost,
              COALESCE(SUM(CASE WHEN created_at >= ${monthStart} AND created_at <= ${nowUTC} THEN refund_amount ELSE 0 END), 0)::numeric AS month_total_refund,

              -- All Time
              COALESCE(SUM(total_amount), 0)::numeric AS all_total_amount,
              COALESCE(SUM(discount), 0)::numeric AS all_total_discount,
              COALESCE(SUM(paid_amount), 0)::numeric AS all_total_paid,
              COALESCE(SUM(due_amount), 0)::numeric AS all_total_due,
              COUNT(1)::int AS all_sales_count,
              COALESCE(SUM(effective_total - refund_amount), 0)::numeric AS all_actual_revenue,
              COALESCE(SUM(sold_cost - returned_cost), 0)::numeric AS all_net_cost,
              COALESCE(SUM(refund_amount), 0)::numeric AS all_total_refund
            FROM sale_metrics
          )
          SELECT * FROM sale_aggregates, expense_metrics, product_metrics
        `,
        this._getSalesChart(owner_id, last7Start, nowUTC),
        this._getRecentActivities(owner_id, 6),
        this.getLowStockItems(owner_id, 40, 5),
      ]);

    const row = statsRowResult[0] || {};

    const productCounts = {
      total:    Number(row.total || 0),
      items:    Number(row.items || 0),
      services: Number(row.services || 0),
    };

    const today = {
      sales: {
        total_amount:    Number(row.today_total_amount || 0),
        total_discount:  Number(row.today_total_discount || 0),
        effective_total: Number(row.today_actual_revenue || 0),
        paid_amount:     Number(row.today_total_paid || 0),
        due_amount:      Number(row.today_total_due || 0),
        total_refund:    Number(row.today_total_refund || 0),
        count:           Number(row.today_sales_count || 0),
      },
      profit: {
        actual_revenue:  Number(row.today_actual_revenue || 0),
        total_cost:      Number(row.today_net_cost || 0),
        total_expenses:  Number(row.today_expenses || 0),
        profit:          Number((Number(row.today_actual_revenue || 0) - Number(row.today_net_cost || 0) - Number(row.today_expenses || 0)).toFixed(2)),
      }
    };

    const thisMonth = {
      sales: {
        total_amount:    Number(row.month_total_amount || 0),
        total_discount:  Number(row.month_total_discount || 0),
        effective_total: Number(row.month_actual_revenue || 0),
        paid_amount:     Number(row.month_total_paid || 0),
        due_amount:      Number(row.month_total_due || 0),
        total_refund:    Number(row.month_total_refund || 0),
        count:           Number(row.month_sales_count || 0),
      },
      profit: {
        actual_revenue:  Number(row.month_actual_revenue || 0),
        total_cost:      Number(row.month_net_cost || 0),
        total_expenses:  Number(row.month_expenses || 0),
        profit:          Number((Number(row.month_actual_revenue || 0) - Number(row.month_net_cost || 0) - Number(row.month_expenses || 0)).toFixed(2)),
      }
    };

    const allTime = {
      sales: {
        total_amount:    Number(row.all_total_amount || 0),
        total_discount:  Number(row.all_total_discount || 0),
        effective_total: Number(row.all_actual_revenue || 0),
        paid_amount:     Number(row.all_total_paid || 0),
        due_amount:      Number(row.all_total_due || 0),
        total_refund:    Number(row.all_total_refund || 0),
        count:           Number(row.all_sales_count || 0),
      },
      profit: {
        actual_revenue:  Number(row.all_actual_revenue || 0),
        total_cost:      Number(row.all_net_cost || 0),
        total_expenses:  Number(row.all_expenses || 0),
        profit:          Number((Number(row.all_actual_revenue || 0) - Number(row.all_net_cost || 0) - Number(row.all_expenses || 0)).toFixed(2)),
      }
    };

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
              AND note NOT LIKE '%[SUPPLIER_PAYMENT:%'
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
              AND note NOT LIKE '%[SUPPLIER_PAYMENT:%'
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
    try {
      const per = Math.max(10, limit);
      const rows = await prisma.$queryRaw`
        (
          SELECT
            'PRODUCT_CREATED' AS type,
            p.created_at,
            'Product added' AS title,
            p.product_name || ' (' || p.type::text || ')' || COALESCE(' • ' || c.category_name, '') AS message,
            p.product_id AS ref_product_id,
            NULL AS ref_lot_id,
            NULL AS ref_sales_id,
            NULL AS ref_return_id
          FROM store_products p
          LEFT JOIN store_categories c ON c.category_id = p.category_id
          WHERE p.owner_id = ${owner_id}
          ORDER BY p.created_at DESC
          LIMIT ${per}
        )
        UNION ALL
        (
          SELECT
            'STOCK_IN' AS type,
            l.created_at,
            'Stock in' AS title,
            COALESCE(p.product_name, 'Product') || ' • +' || l.qty_in || ' ' || COALESCE(u.unit_name, 'units') || COALESCE(' • ' || s.supplier_name, '') AS message,
            p.product_id AS ref_product_id,
            l.lot_id AS ref_lot_id,
            NULL AS ref_sales_id,
            NULL AS ref_return_id
          FROM store_stock_lots l
          LEFT JOIN store_products p ON p.product_id = l.product_id
          LEFT JOIN store_units u ON u.unit_id = p.unit_id
          LEFT JOIN store_suppliers s ON s.supplier_id = l.supplier_id
          WHERE l.owner_id = ${owner_id}
          ORDER BY l.created_at DESC
          LIMIT ${per}
        )
        UNION ALL
        (
          SELECT
            'SALE' AS type,
            s.created_at,
            'Sale' AS title,
            COALESCE(c.full_name, 'Walk-in') || ' • Rs.' || (s.total_amount - COALESCE(s.discount, 0))::numeric || CASE WHEN COALESCE(s.discount, 0) > 0 THEN ' (Disc: ' || s.discount::numeric || ')' ELSE '' END || ' • ' || s.payment_status::text AS message,
            NULL AS ref_product_id,
            NULL AS ref_lot_id,
            s.sales_id AS ref_sales_id,
            NULL AS ref_return_id
          FROM store_sales s
          LEFT JOIN customers c ON c.customer_id = s.customer_id
          WHERE s.owner_id = ${owner_id}
          ORDER BY s.created_at DESC
          LIMIT ${per}
        )
        UNION ALL
        (
          SELECT
            'CUSTOMER_RETURN' AS type,
            r.created_at,
            'Customer return' AS title,
            COALESCE(c.full_name, 'Customer') || ' • Refund Rs.' || COALESCE(r.refund_amount, 0)::numeric AS message,
            NULL AS ref_product_id,
            NULL AS ref_lot_id,
            r.sales_id AS ref_sales_id,
            r.return_id AS ref_return_id
          FROM store_customer_returns r
          LEFT JOIN store_sales ss ON ss.sales_id = r.sales_id
          LEFT JOIN customers c ON c.customer_id = ss.customer_id
          WHERE r.owner_id = ${owner_id}
          ORDER BY r.created_at DESC
          LIMIT ${per}
        )
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;

      return rows.map(r => {
        const ref = {};
        if (r.ref_product_id) ref.product_id = r.ref_product_id;
        if (r.ref_lot_id) ref.lot_id = r.ref_lot_id;
        if (r.ref_sales_id) ref.sales_id = r.ref_sales_id;
        if (r.ref_return_id) ref.return_id = r.ref_return_id;
        return {
          type: r.type,
          created_at: r.created_at,
          title: r.title,
          message: r.message,
          ref
        };
      });
    } catch (err) {
      console.error("Error in optimized _getRecentActivities:", err);
      return [];
    }
  }

  async getLowStockItems(owner_id, threshold = 40, limit = 10) {
    try {
      const [countsResult, lowStockResult, outOfStockResult] = await Promise.all([
        // 1. Get summary counts in one round-trip
        prisma.$queryRaw`
          WITH product_stock AS (
            SELECT
              p.product_id,
              COALESCE(SUM(sl.qty_remaining), 0)::int AS qty_remaining
            FROM store_products p
            LEFT JOIN store_stock_lots sl ON sl.product_id = p.product_id AND sl.owner_id = ${owner_id}
            WHERE p.owner_id = ${owner_id} AND p.type = 'item'
            GROUP BY p.product_id
          )
          SELECT
            COUNT(*)::int AS total_products,
            COUNT(CASE WHEN qty_remaining > 0 AND qty_remaining <= ${threshold} THEN 1 END)::int AS low_stock_count,
            COUNT(CASE WHEN qty_remaining = 0 THEN 1 END)::int AS out_of_stock_count
          FROM product_stock
        `,

        // 2. Get low stock items preview (up to limit)
        prisma.$queryRaw`
          SELECT
            p.product_id,
            p.product_name,
            COALESCE(u.unit_name, 'pcs') AS unit,
            COALESCE(c.category_name, 'Uncategorized') AS category,
            COALESCE(SUM(sl.qty_remaining), 0)::int AS qty_remaining
          FROM store_products p
          LEFT JOIN store_stock_lots sl ON sl.product_id = p.product_id AND sl.owner_id = ${owner_id}
          LEFT JOIN store_categories c ON c.category_id = p.category_id
          LEFT JOIN store_units u ON u.unit_id = p.unit_id
          WHERE p.owner_id = ${owner_id} AND p.type = 'item'
          GROUP BY p.product_id, p.product_name, c.category_name, u.unit_name
          HAVING COALESCE(SUM(sl.qty_remaining), 0) > 0 AND COALESCE(SUM(sl.qty_remaining), 0) <= ${threshold}
          ORDER BY qty_remaining ASC, p.product_name ASC
          LIMIT ${limit}
        `,

        // 3. Get out of stock items preview (up to limit)
        prisma.$queryRaw`
          SELECT
            p.product_id,
            p.product_name,
            COALESCE(u.unit_name, 'pcs') AS unit,
            COALESCE(c.category_name, 'Uncategorized') AS category,
            0::int AS qty_remaining
          FROM store_products p
          LEFT JOIN store_stock_lots sl ON sl.product_id = p.product_id AND sl.owner_id = ${owner_id}
          LEFT JOIN store_categories c ON c.category_id = p.category_id
          LEFT JOIN store_units u ON u.unit_id = p.unit_id
          WHERE p.owner_id = ${owner_id} AND p.type = 'item'
          GROUP BY p.product_id, p.product_name, c.category_name, u.unit_name
          HAVING COALESCE(SUM(sl.qty_remaining), 0) = 0
          ORDER BY p.product_name ASC
          LIMIT ${limit}
        `
      ]);

      const counts = countsResult[0] || { total_products: 0, low_stock_count: 0, out_of_stock_count: 0 };
      const totalCount = Number(counts.total_products || 0);
      const lowStockCount = Number(counts.low_stock_count || 0);
      const outOfStockCount = Number(counts.out_of_stock_count || 0);
      const inStockCount = Math.max(0, totalCount - lowStockCount - outOfStockCount);

      const mapItem = (item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        unit: item.unit || 'units',
        category: item.category === 'Uncategorized' ? null : item.category,
        qty_remaining: Number(item.qty_remaining || 0),
      });

      return {
        summary: {
          total_products: totalCount,
          in_stock: inStockCount,
          low_stock: lowStockCount,
          out_of_stock: outOfStockCount,
        },
        low_stock_items: lowStockResult.map(mapItem),
        out_of_stock_items: outOfStockResult.map(mapItem),
      };
    } catch (err) {
      console.error("Error in optimized getLowStockItems:", err);
      // Fallback response structure in case of query error
      return {
        summary: { total_products: 0, in_stock: 0, low_stock: 0, out_of_stock: 0 },
        low_stock_items: [],
        out_of_stock_items: [],
      };
    }
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