// src/services/storeReportService.js
import storeFinancialsService from "./storeFinancialsService.js";

const NPT_OFFSET_MS = 5 * 60 * 60 * 1000 + 45 * 60 * 1000;

const EPOCH = new Date(0);

function getNPTRanges() {
  const nowUTC = new Date();

  const npt = new Date(nowUTC.getTime() + NPT_OFFSET_MS);

  const todayStart = new Date(
    Date.UTC(
      npt.getUTCFullYear(),
      npt.getUTCMonth(),
      npt.getUTCDate(),
      0,
      0,
      0,
      0,
    ) - NPT_OFFSET_MS,
  );

  const last7Start = new Date(
    Date.UTC(
      npt.getUTCFullYear(),
      npt.getUTCMonth(),
      npt.getUTCDate() - 6,
      0,
      0,
      0,
      0,
    ) - NPT_OFFSET_MS,
  );

  const monthStart = new Date(
    Date.UTC(npt.getUTCFullYear(), npt.getUTCMonth(), 1, 0, 0, 0, 0) -
      NPT_OFFSET_MS,
  );

  return {
    todayStart,
    last7Start,
    monthStart,
    nowUTC,
  };
}

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function toBucket(
  financials,
  expenseBreakdown,
  dueBreakdown,
) {
  return {
    sales_count: financials.order_count,

    // Total Sales = SP × original quantity.
    // Discount, returns and refunds are not deducted.
    sales: money(
      financials.gross_item_sales,
    ),

    gross_sales: money(
      financials.gross_item_sales,
    ),

    actual_revenue: money(
      financials.actual_revenue,
    ),

    gross_revenue: money(
      financials.gross_item_sales,
    ),

    total_discount: money(
      financials.total_discount,
    ),

    net_revenue: money(
      financials.net_revenue,
    ),

    total_refund: money(
      financials.total_refund,
    ),

    cogs: money(financials.cogs),

    returned_cost: money(
      financials.returned_cost,
    ),

    total_cost: money(
      financials.net_cost,
    ),

    gross_profit: money(
      financials.gross_profit,
    ),

    total_paid: money(
      financials.total_paid,
    ),

    expenses: money(
      financials.total_expenses,
    ),

    profit: money(
      financials.net_profit,
    ),

    total_due: money(
      financials.total_due_in_range,
    ),

    expense_breakdown: expenseBreakdown,
    due_breakdown: dueBreakdown,
  };
}

async function getPeriodBucket(owner_id, from, to) {
  const financials = await storeFinancialsService.getCoreFinancials(
    owner_id,
    from,
    to,
  );

  const [expenseBreakdown, dueBreakdown] = await Promise.all([
    storeFinancialsService.getExpenseBreakdown(
      owner_id,
      from,
      to,
      financials.total_expenses,
    ),

    storeFinancialsService.getDueBreakdown(owner_id, from, to),
  ]);

  return toBucket(financials, expenseBreakdown, dueBreakdown);
}

class StoreReportService {
  async getSummary(owner_id, period = "today") {
    try {
      const {
        todayStart,
        last7Start,
        monthStart,
        nowUTC,
      } = getNPTRanges();

      let from;

      switch (period) {
        case "last_7_days":
          from = last7Start;
          break;

        case "this_month":
          from = monthStart;
          break;

        case "all_time":
          from = EPOCH;
          break;

        case "today":
        default:
          from = todayStart;
          break;
      }

      return await getPeriodBucket(
        owner_id,
        from,
        nowUTC,
      );
    } catch (error) {
      console.error(
        "Error in storeReportService.getSummary:",
        error,
      );

      throw error;
    }
  }
}

export default new StoreReportService();
