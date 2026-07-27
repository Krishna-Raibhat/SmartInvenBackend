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
        previous.gross_item_sales === 0
          ? null
          : Number(
              (
                (
                  (current.gross_item_sales -
                    previous.gross_item_sales) /
                  previous.gross_item_sales
                ) *
                100
              ).toFixed(1),
            );

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
        total_sales: Number(
        current.gross_item_sales.toFixed(2),),
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
        avg_sale_value:
        current.order_count > 0
          ? Number(
              (
                current.gross_item_sales /
                current.order_count
              ).toFixed(2),
            )
          : 0,
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

