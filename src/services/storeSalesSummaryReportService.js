// // src/services/storeSalesSummaryReportService.js
// import storeFinancialsService from "./storeFinancialsService.js";

// const RECENT_SALES_LIMIT = 8;
// const TOP_PRODUCTS_LIMIT = 5;

// const ALLOWED_SECTIONS = new Set([
//   "overview",
//   "payment",
//   "daily",
//   "products",
//   "recent",
// ]);

// class StoreSalesSummaryReportService {
//   async getSalesSummary(
//     owner_id,
//     {
//       start,
//       end,
//       include = [
//         "overview",
//         "payment",
//         "daily",
//         "products",
//         "recent",
//       ],
//     } = {},
//   ) {
//     const sections = new Set(
//       include.filter((section) =>
//         ALLOWED_SECTIONS.has(section),
//       ),
//     );

//     const now = new Date();

//     const endFinal = end
//       ? new Date(`${end}T23:59:59.999`)
//       : now;

//     const startFinal = start
//       ? new Date(`${start}T00:00:00.000`)
//       : new Date(
//           endFinal.getTime() -
//             6 * 24 * 60 * 60 * 1000,
//         );

//     startFinal.setHours(0, 0, 0, 0);
//     endFinal.setHours(23, 59, 59, 999);

//     const duration =
//       endFinal.getTime() - startFinal.getTime();

//     const prevEnd = new Date(
//       startFinal.getTime() - 1,
//     );

//     const prevStart = new Date(
//       prevEnd.getTime() - duration,
//     );

//     const tasks = [];
//     const taskNames = [];

//     if (sections.has("overview")) {
//       tasks.push(
//         storeFinancialsService.getCoreFinancials(
//           owner_id,
//           startFinal,
//           endFinal,
//         ),
//       );
//       taskNames.push("current");

//       tasks.push(
//         storeFinancialsService.getCoreFinancials(
//           owner_id,
//           prevStart,
//           prevEnd,
//         ),
//       );
//       taskNames.push("previous");
//     }

//     if (sections.has("payment")) {
//       tasks.push(
//         storeFinancialsService.getPaymentBreakdown(
//           owner_id,
//           startFinal,
//           endFinal,
//         ),
//       );
//       taskNames.push("payment");
//     }

//     if (sections.has("daily")) {
//       tasks.push(
//         storeFinancialsService.getDailyTrend(
//           owner_id,
//           startFinal,
//           endFinal,
//         ),
//       );
//       taskNames.push("daily");
//     }

//     if (sections.has("products")) {
//       tasks.push(
//         storeFinancialsService.getProductBreakdown(
//           owner_id,
//           startFinal,
//           endFinal,
//         ),
//       );
//       taskNames.push("products");
//     }

//     if (sections.has("recent")) {
//       tasks.push(
//         storeFinancialsService.getRecentSales(
//           owner_id,
//           startFinal,
//           endFinal,
//           RECENT_SALES_LIMIT,
//         ),
//       );
//       taskNames.push("recentSales");
//     }

//     const results = await Promise.all(tasks);

//     const loaded = {};

//     for (let i = 0; i < taskNames.length; i++) {
//       loaded[taskNames[i]] = results[i];
//     }

//     const response = {
//       range: {
//         start: startFinal,
//         end: endFinal,
//       },
//     };

//     if (sections.has("overview")) {
//       const current = loaded.current;
//       const previous = loaded.previous;

//       const revenueGrowthPct =
//         previous.gross_item_sales === 0
//           ? null
//           : Number(
//               (
//                 ((current.gross_item_sales -
//                   previous.gross_item_sales) /
//                   previous.gross_item_sales) *
//                 100
//               ).toFixed(1),
//             );

//       const profitMargin =
//         current.actual_revenue > 0
//           ? Number(
//               (
//                 (current.net_profit /
//                   current.actual_revenue) *
//                 100
//               ).toFixed(1),
//             )
//           : 0;

//       Object.assign(response, {
//         total_sales: Number(
//           current.gross_item_sales.toFixed(2),
//         ),
//         gross_revenue: Number(
//           current.gross_revenue.toFixed(2),
//         ),
//         total_discount: Number(
//           current.total_discount.toFixed(2),
//         ),
//         net_revenue: Number(
//           current.net_revenue.toFixed(2),
//         ),
//         actual_revenue: Number(
//           current.actual_revenue.toFixed(2),
//         ),
//         total_refund: Number(
//           current.total_refund.toFixed(2),
//         ),
//         net_profit: Number(
//           current.net_profit.toFixed(2),
//         ),
//         profit_margin: profitMargin,
//         total_expenses: Number(
//           current.total_expenses.toFixed(2),
//         ),
//         total_cogs: Number(
//           current.net_cost.toFixed(2),
//         ),
//         revenue_growth_pct: revenueGrowthPct,
//         order_count: current.order_count,
//         avg_sale_value:
//           current.order_count > 0
//             ? Number(
//                 (
//                   current.gross_item_sales /
//                   current.order_count
//                 ).toFixed(2),
//               )
//             : 0,
//         total_due: Number(
//           current.total_due_in_range.toFixed(2),
//         ),
//       });
//     }

//     if (sections.has("payment")) {
//       const payment = loaded.payment;

//       Object.assign(response, {
//         paid_count:
//           payment.statusCounts.paid,
//         partial_count:
//           payment.statusCounts.partial,
//         pending_count:
//           payment.statusCounts.pending,
//         cash_revenue:
//           payment.cashRevenue,
//         online_revenue:
//           payment.onlineRevenue,
//       });
//     }

//     if (sections.has("daily")) {
//       const daily = loaded.daily;

//       const dayMap = new Map(
//         daily.map((item) => [
//           item.date,
//           item.revenue,
//         ]),
//       );

//       const dailyRevenue = [];
//       const cursor = new Date(startFinal);

//       while (cursor <= endFinal) {
//         const key = cursor
//           .toISOString()
//           .slice(0, 10);

//         dailyRevenue.push({
//           date: new Date(cursor),
//           amount: dayMap.get(key) ?? 0,
//         });

//         cursor.setDate(cursor.getDate() + 1);
//       }

//       response.daily_revenue = dailyRevenue;
//     }

//     if (sections.has("products")) {
//       const products = loaded.products;

//       response.top_products = products
//         .filter((product) => product.revenue > 0)
//         .sort(
//           (a, b) =>
//             b.revenue - a.revenue,
//         )
//         .slice(0, TOP_PRODUCTS_LIMIT)
//         .map((product) => ({
//           product_id: product.product_id,
//           name: product.product_name,
//           qty: product.qty,
//           revenue: Number(
//             product.revenue.toFixed(2),
//           ),
//         }));
//     }

//     if (sections.has("recent")) {
//       response.recent_sales =
//         loaded.recentSales;
//     }

//     return response;
//   }
// }

// export default new StoreSalesSummaryReportService();

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

function roundMoney(value) {
  return Number((Number(value) || 0).toFixed(2));
}

class StoreSalesSummaryReportService {
  async getSalesSummary(
    owner_id,
    {
      start,
      end,
      include = ["overview", "payment", "daily", "products", "recent"],
    } = {},
  ) {
    const requestedSections = Array.isArray(include) ? include : [];

    const sections = new Set(
      requestedSections.filter((section) => ALLOWED_SECTIONS.has(section)),
    );

    const now = new Date();

    const endFinal = end ? new Date(`${end}T23:59:59.999`) : now;

    const startFinal = start
      ? new Date(`${start}T00:00:00.000`)
      : new Date(endFinal.getTime() - 6 * 24 * 60 * 60 * 1000);

    if (
      Number.isNaN(startFinal.getTime()) ||
      Number.isNaN(endFinal.getTime())
    ) {
      throw new Error("Invalid report date range.");
    }

    startFinal.setHours(0, 0, 0, 0);
    endFinal.setHours(23, 59, 59, 999);

    if (startFinal > endFinal) {
      throw new Error("Report start date cannot be after end date.");
    }

    const duration = endFinal.getTime() - startFinal.getTime();

    const prevEnd = new Date(startFinal.getTime() - 1);

    const prevStart = new Date(prevEnd.getTime() - duration);

    const tasks = [];
    const taskNames = [];

    // ─────────────────────────────────────────────
    // OVERVIEW
    // ─────────────────────────────────────────────
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
        storeFinancialsService.getCoreFinancials(owner_id, prevStart, prevEnd),
      );
      taskNames.push("previous");
    }

    // ─────────────────────────────────────────────
    // PAYMENT
    // ─────────────────────────────────────────────
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

    // ─────────────────────────────────────────────
    // DAILY TREND
    // ─────────────────────────────────────────────
    if (sections.has("daily")) {
      tasks.push(
        storeFinancialsService.getDailyTrend(owner_id, startFinal, endFinal),
      );
      taskNames.push("daily");
    }

    // ─────────────────────────────────────────────
    // PRODUCTS
    // ─────────────────────────────────────────────
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

    // ─────────────────────────────────────────────
    // RECENT SALES
    // ─────────────────────────────────────────────
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

    // ═════════════════════════════════════════════
    // OVERVIEW RESPONSE
    // ═════════════════════════════════════════════
    if (sections.has("overview")) {
      const current = loaded.current;
      const previous = loaded.previous;

      /*
       * These are needed by the Expenses and Dues
       * calculation bottom sheets.
       */
      const [expenseBreakdown, dueBreakdown] = await Promise.all([
        storeFinancialsService.getExpenseBreakdown(
          owner_id,
          startFinal,
          endFinal,
          current.total_expenses,
        ),

        storeFinancialsService.getDueBreakdown(owner_id, startFinal, endFinal),
      ]);

      const revenueGrowthPct =
        previous.gross_item_sales === 0
          ? null
          : Number(
              (
                ((current.gross_item_sales - previous.gross_item_sales) /
                  previous.gross_item_sales) *
                100
              ).toFixed(1),
            );

      const profitMargin =
        current.actual_revenue > 0
          ? Number(
              ((current.net_profit / current.actual_revenue) * 100).toFixed(1),
            )
          : 0;

      Object.assign(response, {
        /*
         * Selling price × original sold quantity.
         */
        total_sales: roundMoney(current.gross_item_sales),

        /*
         * Sum of sale total_amount before discount.
         */
        gross_revenue: roundMoney(current.gross_revenue),

        total_discount: roundMoney(current.total_discount),

        /*
         * Gross revenue − discount.
         */
        net_revenue: roundMoney(current.net_revenue),

        /*
         * Net revenue − customer refunds.
         */
        actual_revenue: roundMoney(current.actual_revenue),

        total_refund: roundMoney(current.total_refund),

        /*
         * Original cost of all sold products.
         */
        gross_cogs: roundMoney(current.cogs),

        /*
         * Cost value of returned products.
         */
        returned_cost: roundMoney(current.returned_cost),

        /*
         * Gross COGS − returned cost.
         */
        total_cogs: roundMoney(current.net_cost),

        /*
         * Actual revenue − net product cost.
         */
        gross_profit: roundMoney(current.gross_profit),

        /*
         * Gross profit − expenses.
         */
        net_profit: roundMoney(current.net_profit),

        profit_margin: profitMargin,

        total_expenses: roundMoney(current.total_expenses),

        total_paid: roundMoney(current.total_paid),

        total_due: roundMoney(current.total_due_in_range),

        revenue_growth_pct: revenueGrowthPct,

        order_count: Number(current.order_count || 0),

        /*
         * Average original sales value.
         */
        avg_sale_value:
          current.order_count > 0
            ? roundMoney(current.gross_item_sales / current.order_count)
            : 0,

        /*
         * Data used by Expenses modal.
         */
        expense_breakdown: expenseBreakdown.map((expense) => ({
          title: expense.title,
          amount: roundMoney(expense.amount),
          pct: Number((Number(expense.pct) || 0).toFixed(1)),
        })),

        /*
         * Data used by Outstanding Dues modal.
         */
        due_breakdown: {
          customer_count: Number(dueBreakdown.customer_count || 0),

          top_customers: (dueBreakdown.top_customers || []).map((customer) => ({
            customer_name: customer.customer_name || "Walk-in Customer",

            invoice_count: Number(customer.invoice_count || 0),

            amount: roundMoney(customer.amount),
          })),

          other_amount: roundMoney(dueBreakdown.other_amount),
        },
      });
    }

    // ═════════════════════════════════════════════
    // PAYMENT RESPONSE
    // ═════════════════════════════════════════════
    if (sections.has("payment")) {
      const payment = loaded.payment;

      Object.assign(response, {
        paid_count: Number(payment.statusCounts.paid || 0),

        partial_count: Number(payment.statusCounts.partial || 0),

        pending_count: Number(payment.statusCounts.pending || 0),

        cash_revenue: roundMoney(payment.cashRevenue),

        online_revenue: roundMoney(payment.onlineRevenue),
      });
    }

    // ═════════════════════════════════════════════
    // DAILY TREND RESPONSE
    // ═════════════════════════════════════════════
    if (sections.has("daily")) {
      const daily = loaded.daily || [];

      const dayMap = new Map(
        daily.map((item) => [item.date, roundMoney(item.revenue)]),
      );

      const dailyRevenue = [];
      const cursor = new Date(startFinal);

      while (cursor <= endFinal) {
        const key = cursor.toISOString().slice(0, 10);

        dailyRevenue.push({
          date: new Date(cursor),
          amount: dayMap.get(key) ?? 0,
        });

        cursor.setDate(cursor.getDate() + 1);
      }

      response.daily_revenue = dailyRevenue;
    }

    // ═════════════════════════════════════════════
    // TOP PRODUCTS RESPONSE
    // ═════════════════════════════════════════════
    if (sections.has("products")) {
      const products = loaded.products || [];

      response.top_products = products
        .filter((product) => Number(product.revenue || 0) > 0)
        .sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0))
        .slice(0, TOP_PRODUCTS_LIMIT)
        .map((product) => ({
          product_id: product.product_id,

          name: product.product_name || "Unknown Product",

          qty: Number(product.qty || 0),

          revenue: roundMoney(product.revenue),
        }));
    }

    // ═════════════════════════════════════════════
    // RECENT SALES RESPONSE
    // ═════════════════════════════════════════════
    if (sections.has("recent")) {
      response.recent_sales = (loaded.recentSales || []).map((sale) => ({
        ...sale,
        amount: roundMoney(sale.amount),
      }));
    }

    return response;
  }
}

export default new StoreSalesSummaryReportService();
