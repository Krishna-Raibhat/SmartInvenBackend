// src/services/storeSalesSummaryReportService.js
import storeFinancialsService from "./storeFinancialsService.js";

const RECENT_SALES_LIMIT = 8;
const TOP_PRODUCTS_LIMIT = 5;

const ALLOWED_SECTIONS = new Set([
  "overview",
  "payment",
  "daily",
  "products",
  "recent",
]);

class StoreSalesSummaryReportService {
  async getSalesSummary(
    owner_id,
    {
      start,
      end,
      include = [
        "overview",
        "payment",
        "daily",
        "products",
        "recent",
      ],
    } = {},
  ) {
    const sections = new Set(
      include.filter((section) =>
        ALLOWED_SECTIONS.has(section),
      ),
    );

    const now = new Date();

    const endFinal = end
      ? new Date(`${end}T23:59:59.999`)
      : now;

    const startFinal = start
      ? new Date(`${start}T00:00:00.000`)
      : new Date(
          endFinal.getTime() -
            6 * 24 * 60 * 60 * 1000,
        );

    startFinal.setHours(0, 0, 0, 0);
    endFinal.setHours(23, 59, 59, 999);

    const duration =
      endFinal.getTime() - startFinal.getTime();

    const prevEnd = new Date(
      startFinal.getTime() - 1,
    );

    const prevStart = new Date(
      prevEnd.getTime() - duration,
    );

    const tasks = [];
    const taskNames = [];

    if (sections.has("overview")) {
      tasks.push(
        storeFinancialsService.getCoreFinancials(
          owner_id,
          startFinal,
          endFinal,
        ),
      );
      taskNames.push("current");

      tasks.push(
        storeFinancialsService.getCoreFinancials(
          owner_id,
          prevStart,
          prevEnd,
        ),
      );
      taskNames.push("previous");
    }

    if (sections.has("payment")) {
      tasks.push(
        storeFinancialsService.getPaymentBreakdown(
          owner_id,
          startFinal,
          endFinal,
        ),
      );
      taskNames.push("payment");
    }

    if (sections.has("daily")) {
      tasks.push(
        storeFinancialsService.getDailyTrend(
          owner_id,
          startFinal,
          endFinal,
        ),
      );
      taskNames.push("daily");
    }

    if (sections.has("products")) {
      tasks.push(
        storeFinancialsService.getProductBreakdown(
          owner_id,
          startFinal,
          endFinal,
        ),
      );
      taskNames.push("products");
    }

    if (sections.has("recent")) {
      tasks.push(
        storeFinancialsService.getRecentSales(
          owner_id,
          startFinal,
          endFinal,
          RECENT_SALES_LIMIT,
        ),
      );
      taskNames.push("recentSales");
    }

    const results = await Promise.all(tasks);

    const loaded = {};

    for (let i = 0; i < taskNames.length; i++) {
      loaded[taskNames[i]] = results[i];
    }

    const response = {
      range: {
        start: startFinal,
        end: endFinal,
      },
    };

    if (sections.has("overview")) {
      const current = loaded.current;
      const previous = loaded.previous;

      const revenueGrowthPct =
        previous.gross_item_sales === 0
          ? null
          : Number(
              (
                ((current.gross_item_sales -
                  previous.gross_item_sales) /
                  previous.gross_item_sales) *
                100
              ).toFixed(1),
            );

      const profitMargin =
        current.actual_revenue > 0
          ? Number(
              (
                (current.net_profit /
                  current.actual_revenue) *
                100
              ).toFixed(1),
            )
          : 0;

      Object.assign(response, {
        total_sales: Number(
          current.gross_item_sales.toFixed(2),
        ),
        gross_revenue: Number(
          current.gross_revenue.toFixed(2),
        ),
        total_discount: Number(
          current.total_discount.toFixed(2),
        ),
        net_revenue: Number(
          current.net_revenue.toFixed(2),
        ),
        actual_revenue: Number(
          current.actual_revenue.toFixed(2),
        ),
        total_refund: Number(
          current.total_refund.toFixed(2),
        ),
        net_profit: Number(
          current.net_profit.toFixed(2),
        ),
        profit_margin: profitMargin,
        total_expenses: Number(
          current.total_expenses.toFixed(2),
        ),
        total_cogs: Number(
          current.net_cost.toFixed(2),
        ),
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
        total_due: Number(
          current.total_due_in_range.toFixed(2),
        ),
      });
    }

    if (sections.has("payment")) {
      const payment = loaded.payment;

      Object.assign(response, {
        paid_count:
          payment.statusCounts.paid,
        partial_count:
          payment.statusCounts.partial,
        pending_count:
          payment.statusCounts.pending,
        cash_revenue:
          payment.cashRevenue,
        online_revenue:
          payment.onlineRevenue,
      });
    }

    if (sections.has("daily")) {
      const daily = loaded.daily;

      const dayMap = new Map(
        daily.map((item) => [
          item.date,
          item.revenue,
        ]),
      );

      const dailyRevenue = [];
      const cursor = new Date(startFinal);

      while (cursor <= endFinal) {
        const key = cursor
          .toISOString()
          .slice(0, 10);

        dailyRevenue.push({
          date: new Date(cursor),
          amount: dayMap.get(key) ?? 0,
        });

        cursor.setDate(cursor.getDate() + 1);
      }

      response.daily_revenue = dailyRevenue;
    }

    if (sections.has("products")) {
      const products = loaded.products;

      response.top_products = products
        .filter((product) => product.revenue > 0)
        .sort(
          (a, b) =>
            b.revenue - a.revenue,
        )
        .slice(0, TOP_PRODUCTS_LIMIT)
        .map((product) => ({
          product_id: product.product_id,
          name: product.product_name,
          qty: product.qty,
          revenue: Number(
            product.revenue.toFixed(2),
          ),
        }));
    }

    if (sections.has("recent")) {
      response.recent_sales =
        loaded.recentSales;
    }

    return response;
  }
}

export default new StoreSalesSummaryReportService();