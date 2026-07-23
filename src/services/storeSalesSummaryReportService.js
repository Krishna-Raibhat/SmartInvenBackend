// src/services/storeSalesSummaryReportService.js
import storeFinancialsService from "./storeFinancialsService.js";

const RECENT_SALES_LIMIT = 8;
const TOP_PRODUCTS_LIMIT = 5;

class StoreSalesSummaryReportService {
  async getSalesSummary(owner_id, { start, end } = {}) {
    try {
      const now = new Date();
      const endFinal = end ? new Date(end) : now;
      endFinal.setHours(23, 59, 59, 999);

      const startFinal = start
        ? new Date(start)
        : new Date(endFinal.getTime() - 6 * 24 * 60 * 60 * 1000); // default: last 7 days
      startFinal.setHours(0, 0, 0, 0);

      const duration = endFinal - startFinal;
      const prevEnd = new Date(startFinal.getTime() - 1);
      const prevStart = new Date(startFinal.getTime() - duration - 1);

      const [current, previous, payment, daily, products, recentSales] = await Promise.all([
        storeFinancialsService.getCoreFinancials(owner_id, startFinal, endFinal),
        storeFinancialsService.getCoreFinancials(owner_id, prevStart, prevEnd),
        storeFinancialsService.getPaymentBreakdown(owner_id, startFinal, endFinal),
        storeFinancialsService.getDailyTrend(owner_id, startFinal, endFinal),
        storeFinancialsService.getProductBreakdown(owner_id, startFinal, endFinal),
        storeFinancialsService.getRecentSales(owner_id, startFinal, endFinal, RECENT_SALES_LIMIT),
      ]);

      const revenueGrowthPct =
        previous.net_revenue === 0
          ? null
          : Number((((current.net_revenue - previous.net_revenue) / previous.net_revenue) * 100).toFixed(1));

      const profitMargin =
        current.actual_revenue > 0
          ? Number(((current.net_profit / current.actual_revenue) * 100).toFixed(1))
          : 0;

      // Fill zero-revenue days so the chart has no gaps
      const dayMap = new Map(daily.map((d) => [d.date, d.revenue]));
      const dailyRevenue = [];
      const cursor = new Date(startFinal);
      while (cursor <= endFinal) {
        const key = cursor.toISOString().slice(0, 10);
        dailyRevenue.push({ date: new Date(cursor), amount: dayMap.get(key) ?? 0 });
        cursor.setDate(cursor.getDate() + 1);
      }

      const topProducts = products
        .filter((p) => p.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, TOP_PRODUCTS_LIMIT)
        .map((p) => ({
          product_id: p.product_id,
          name: p.product_name,
          qty: p.qty,
          revenue: Number(p.revenue.toFixed(2)),
        }));

      return {
        range: { start: startFinal, end: endFinal },
        gross_revenue: current.gross_revenue,
        total_discount: current.total_discount,
        net_revenue: current.net_revenue,
        actual_revenue: Number(current.actual_revenue.toFixed(2)),
        total_refund: Number(current.total_refund.toFixed(2)),
        net_profit: Number(current.net_profit.toFixed(2)),
        profit_margin: profitMargin,
        total_expenses: Number(current.total_expenses.toFixed(2)),
        total_cogs: Number(current.net_cost.toFixed(2)), // net_cost (after returns)
        revenue_growth_pct: revenueGrowthPct,
        order_count: current.order_count,
        avg_sale_value: current.order_count > 0 ? Number((current.net_revenue / current.order_count).toFixed(2)) : 0,
        total_due: Number(current.total_due_in_range.toFixed(2)),
        paid_count: payment.statusCounts.paid,
        partial_count: payment.statusCounts.partial,
        pending_count: payment.statusCounts.pending,
        cash_revenue: payment.cashRevenue,
        online_revenue: payment.onlineRevenue,
        daily_revenue: dailyRevenue,
        top_products: topProducts,
        recent_sales: recentSales,
      };
    } catch (error) {
      console.error('Error in StoreSalesSummaryReportService.getSalesSummary:', error);
      throw error;
    }
  }
}

export default new StoreSalesSummaryReportService();

// // src/services/storeSalesSummaryReportService.js
// import { prisma } from "../prisma/client.js";

// const RECENT_SALES_LIMIT = 8;
// const TOP_PRODUCTS_LIMIT = 5;

// class StoreSalesSummaryReportService {
//   async getSalesSummary(owner_id, { start, end } = {}) {
//     try {
//       const now = new Date();
//       const endFinal = end ? new Date(end) : now;
//       endFinal.setHours(23, 59, 59, 999);

//       const startFinal = start
//         ? new Date(start)
//         : new Date(endFinal.getTime() - 6 * 24 * 60 * 60 * 1000); // default: last 7 days
//       startFinal.setHours(0, 0, 0, 0);

//       const duration = endFinal - startFinal;
//       const prevEnd = new Date(startFinal.getTime() - 1);
//       const prevStart = new Date(startFinal.getTime() - duration - 1);

//     const [
//       summaryRows,
//       prevRows,
//       statusRows,
//       methodRows,
//       cogsAndReturnsRows,
//       dailyRows,
//       productRows,
//       expenseRows,
//       recentSalesRaw,
//     ] = await Promise.all([
//       prisma.$queryRaw`
//         SELECT
//           COALESCE(SUM(total_amount), 0)::numeric              AS gross_revenue,
//           COALESCE(SUM(discount), 0)::numeric                   AS total_discount,
//           COALESCE(SUM(total_amount - discount), 0)::numeric    AS net_revenue,
//           COALESCE(SUM(due_amount), 0)::numeric                 AS total_due,
//           COUNT(*)::int                                         AS order_count
//         FROM store_sales
//         WHERE owner_id = ${owner_id}
//           AND created_at >= ${startFinal}
//           AND created_at <= ${endFinal}
//       `,

//       prisma.$queryRaw`
//         SELECT COALESCE(SUM(total_amount - discount), 0)::numeric AS net_revenue
//         FROM store_sales
//         WHERE owner_id = ${owner_id}
//           AND created_at >= ${prevStart}
//           AND created_at <= ${prevEnd}
//       `,

//       prisma.$queryRaw`
//         SELECT payment_status, COUNT(*)::int AS count
//         FROM store_sales
//         WHERE owner_id = ${owner_id}
//           AND created_at >= ${startFinal}
//           AND created_at <= ${endFinal}
//         GROUP BY payment_status
//       `,

//       prisma.$queryRaw`
//         SELECT payment_method, COALESCE(SUM(total_amount - discount), 0)::numeric AS amount
//         FROM store_sales
//         WHERE owner_id = ${owner_id}
//           AND created_at >= ${startFinal}
//           AND created_at <= ${endFinal}
//         GROUP BY payment_method
//       `,

//       // Cost of goods sold & customer returns (combined to match dashboard logic)
//       prisma.$queryRaw`
//         WITH sold AS (
//           SELECT
//             ss.sales_id,
//             GREATEST(ss.total_amount - COALESCE(ss.discount, 0), 0) AS effective_total,
//             COALESCE(SUM(COALESCE(ssi.cp, 0) * ssi.qty), 0)         AS sold_cost
//           FROM store_sales_items ssi
//           JOIN store_sales ss ON ss.sales_id = ssi.sales_id
//           WHERE ss.owner_id = ${owner_id}
//             AND ss.created_at >= ${startFinal}
//             AND ss.created_at <= ${endFinal}
//           GROUP BY ss.sales_id, ss.total_amount, ss.discount
//         ),
//         returns AS (
//           SELECT
//             r_refund.sales_id,
//             COALESCE(r_refund.total_refund, 0) AS total_refund,
//             COALESCE(r_cost.returned_cost, 0) AS returned_cost
//           FROM (
//             SELECT sales_id, SUM(refund_amount) AS total_refund
//             FROM store_customer_returns
//             WHERE owner_id = ${owner_id}
//               AND created_at >= ${startFinal}
//               AND created_at <= ${endFinal}
//             GROUP BY sales_id
//           ) r_refund
//           LEFT JOIN (
//             SELECT scr.sales_id, SUM(COALESCE(ssi.cp, 0) * scri.qty) AS returned_cost
//             FROM store_customer_returns scr
//             JOIN store_customer_return_items scri ON scri.return_id = scri.return_id
//             JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
//             WHERE scr.owner_id = ${owner_id}
//               AND scr.created_at >= ${startFinal}
//               AND scr.created_at <= ${endFinal}
//             GROUP BY scr.sales_id
//           ) r_cost ON r_cost.sales_id = r_refund.sales_id
//         )
//         SELECT
//           COALESCE(SUM(s.effective_total), 0) - COALESCE(SUM(r.total_refund), 0)  AS actual_revenue,
//           COALESCE(SUM(s.sold_cost), 0)       - COALESCE(SUM(r.returned_cost), 0) AS net_cost,
//           COALESCE(SUM(r.total_refund), 0)                                        AS total_refund
//         FROM sold s
//         LEFT JOIN returns r ON r.sales_id = s.sales_id
//       `,

//       prisma.$queryRaw`
//         WITH daily_sales AS (
//           SELECT
//             date_trunc('day', ss.created_at) AS day,
//             ss.sales_id,
//             GREATEST(ss.total_amount - COALESCE(ss.discount, 0), 0) AS effective_total
//           FROM store_sales ss
//           WHERE ss.owner_id = ${owner_id}
//             AND ss.created_at >= ${startFinal}
//             AND ss.created_at <= ${endFinal}
//         ),
//         daily_returns AS (
//           SELECT
//             date_trunc('day', scr.created_at) AS day,
//             scr.sales_id,
//             COALESCE(SUM(scr.refund_amount), 0) AS total_refund
//           FROM store_customer_returns scr
//           WHERE scr.owner_id = ${owner_id}
//             AND scr.created_at >= ${startFinal}
//             AND scr.created_at <= ${endFinal}
//           GROUP BY date_trunc('day', scr.created_at), scr.sales_id
//         )
//         SELECT
//           ds.day,
//           COALESCE(SUM(ds.effective_total), 0) - COALESCE(SUM(dr.total_refund), 0) AS amount
//         FROM daily_sales ds
//         LEFT JOIN daily_returns dr ON dr.day = ds.day AND dr.sales_id = ds.sales_id
//         GROUP BY ds.day
//         ORDER BY ds.day ASC
//       `,

//       prisma.$queryRaw`
//         WITH sold_items AS (
//           SELECT
//             si.product_id,
//             p.product_name,
//             si.sales_item_id,
//             si.qty AS sold_qty,
//             si.line_total
//           FROM store_sales_items si
//           JOIN store_sales s ON s.sales_id = si.sales_id
//           JOIN store_products p ON p.product_id = si.product_id
//           WHERE s.owner_id = ${owner_id}
//             AND s.created_at >= ${startFinal}
//             AND s.created_at <= ${endFinal}
//         ),
//         returned_items AS (
//           SELECT
//             si.product_id,
//             scri.sales_item_id,
//             COALESCE(SUM(scri.qty), 0) AS returned_qty,
//             COALESCE(SUM(si.sp * scri.qty), 0) AS returned_revenue
//           FROM store_customer_return_items scri
//           JOIN store_customer_returns scr ON scr.return_id = scri.return_id
//           JOIN store_sales_items si ON si.sales_item_id = scri.sales_item_id
//           WHERE scr.owner_id = ${owner_id}
//             AND scr.created_at >= ${startFinal}
//             AND scr.created_at <= ${endFinal}
//           GROUP BY si.product_id, scri.sales_item_id
//         )
//         SELECT
//           si.product_id,
//           si.product_name,
//           SUM(si.sold_qty) - COALESCE(SUM(ri.returned_qty), 0) AS qty,
//           COALESCE(SUM(si.line_total), 0) - COALESCE(SUM(ri.returned_revenue), 0) AS revenue
//         FROM sold_items si
//         LEFT JOIN returned_items ri ON ri.sales_item_id = si.sales_item_id
//         GROUP BY si.product_id, si.product_name
//         HAVING (COALESCE(SUM(si.line_total), 0) - COALESCE(SUM(ri.returned_revenue), 0)) > 0
//         ORDER BY revenue DESC
//         LIMIT ${TOP_PRODUCTS_LIMIT}
//       `,

//       prisma.$queryRaw`
//         SELECT COALESCE(SUM(amount), 0)::numeric AS total_expenses
//         FROM store_expenses
//         WHERE owner_id = ${owner_id}
//           AND created_at >= ${startFinal}
//           AND created_at <= ${endFinal}
//       `,

//       prisma.$queryRaw`
//         WITH recent_sales_base AS (
//           SELECT
//             ss.sales_id,
//             ss.total_amount,
//             ss.discount,
//             ss.payment_status,
//             ss.created_at,
//             c.full_name AS customer_name,
//             GREATEST(ss.total_amount - COALESCE(ss.discount, 0), 0) AS effective_total
//           FROM store_sales ss
//           LEFT JOIN customers c ON c.customer_id = ss.customer_id
//           WHERE ss.owner_id = ${owner_id}
//             AND ss.created_at >= ${startFinal}
//             AND ss.created_at <= ${endFinal}
//           ORDER BY ss.created_at DESC
//           LIMIT ${RECENT_SALES_LIMIT}
//         ),
//         sale_returns AS (
//           SELECT
//             scr.sales_id,
//             COALESCE(SUM(scr.refund_amount), 0) AS total_refund
//           FROM store_customer_returns scr
//           WHERE scr.owner_id = ${owner_id}
//           GROUP BY scr.sales_id
//         )
//         SELECT
//           rsb.sales_id,
//           rsb.customer_name,
//           rsb.payment_status,
//           rsb.created_at,
//           rsb.effective_total - COALESCE(sr.total_refund, 0) AS net_amount
//         FROM recent_sales_base rsb
//         LEFT JOIN sale_returns sr ON sr.sales_id = rsb.sales_id
//         ORDER BY rsb.created_at DESC
//       `,
//     ]);

//     const s = summaryRows[0] || {};
//     const grossRevenue = Number(s.gross_revenue || 0);
//     const totalDiscount = Number(s.total_discount || 0);
//     const netRevenue = Number(s.net_revenue || 0);
//     const totalDue = Number(s.total_due || 0);
//     const orderCount = Number(s.order_count || 0);

//     const prevNetRevenue = Number(prevRows[0]?.net_revenue || 0);
//     const revenueGrowthPct =
//       prevNetRevenue === 0
//         ? null
//         : Number((((netRevenue - prevNetRevenue) / prevNetRevenue) * 100).toFixed(1));

//     const statusCounts = { paid: 0, partial: 0, pending: 0 };
//     for (const row of statusRows) {
//       if (statusCounts[row.payment_status] !== undefined) {
//         statusCounts[row.payment_status] = Number(row.count);
//       }
//     }

//     let cashRevenue = 0;
//     let onlineRevenue = 0;
//     for (const row of methodRows) {
//       if (row.payment_method === "cash") cashRevenue = Number(row.amount);
//       if (row.payment_method === "online") onlineRevenue = Number(row.amount);
//     }

//     // Use actual_revenue (after returns) for profit calculation - matches dashboard
//     const cogsData = cogsAndReturnsRows[0] || {};
//     const actualRevenue = Number(cogsData.actual_revenue || 0);
//     const netCost = Number(cogsData.net_cost || 0);
//     const totalRefund = Number(cogsData.total_refund || 0);
//     const totalExpenses = Number(expenseRows[0]?.total_expenses || 0);
    
//     // Profit calculation matches dashboard: actual_revenue - net_cost - expenses
//     const netProfit = actualRevenue - netCost - totalExpenses;
//     const profitMargin = actualRevenue > 0 ? Number(((netProfit / actualRevenue) * 100).toFixed(1)) : 0;

//     // Fill zero-revenue days so the chart has no gaps
//     const dayMap = new Map(
//       dailyRows.map((r) => [new Date(r.day).toISOString().slice(0, 10), Number(r.amount)]),
//     );
//     const dailyRevenue = [];
//     const cursor = new Date(startFinal);
//     while (cursor <= endFinal) {
//       const key = cursor.toISOString().slice(0, 10);
//       dailyRevenue.push({ date: new Date(cursor), amount: dayMap.get(key) ?? 0 });
//       cursor.setDate(cursor.getDate() + 1);
//     }

//     const topProducts = productRows.map((r) => ({
//       product_id: r.product_id,
//       name: r.product_name,
//       qty: Number(r.qty),
//       revenue: Number(r.revenue),
//     }));

//     const recentSales = recentSalesRaw.map((sale) => ({
//       sales_id: sale.sales_id,
//       customer_name: sale.customer_name || "Walk-in Customer",
//       date: sale.created_at,
//       amount: Number(sale.net_amount || 0),
//       status: sale.payment_status,
//     }));

//     return {
//       range: { start: startFinal, end: endFinal },
//       gross_revenue: grossRevenue,
//       total_discount: totalDiscount,
//       net_revenue: netRevenue,
//       actual_revenue: actualRevenue,  // Revenue after returns (matches dashboard)
//       total_refund: totalRefund,      // Total customer returns/refunds
//       net_profit: netProfit,
//       profit_margin: profitMargin,
//       total_expenses: totalExpenses,
//       total_cogs: netCost,            // Renamed from total_cogs to net_cost (after returns)
//       revenue_growth_pct: revenueGrowthPct,
//       order_count: orderCount,
//       avg_sale_value: orderCount > 0 ? Number((netRevenue / orderCount).toFixed(2)) : 0,
//       total_due: totalDue,
//       paid_count: statusCounts.paid,
//       partial_count: statusCounts.partial,
//       pending_count: statusCounts.pending,
//       cash_revenue: cashRevenue,
//       online_revenue: onlineRevenue,
//       daily_revenue: dailyRevenue,
//       top_products: topProducts,
//       recent_sales: recentSales,
//     };
//   } catch (error) {
//     console.error('Error in StoreSalesSummaryReportService.getSalesSummary:', error);
//     throw error;
//   }
//   }
// }

// export default new StoreSalesSummaryReportService();