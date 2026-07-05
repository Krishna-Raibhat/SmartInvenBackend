// src/services/storeReportService.js
import { prisma } from "../prisma/client.js";

const NPT_OFFSET_MS = 5 * 60 * 60 * 1000 + 45 * 60 * 1000; // UTC+5:45

function getNPTRanges() {
  const nowUTC = new Date();
  const npt = new Date(nowUTC.getTime() + NPT_OFFSET_MS);

  const todayStart = new Date(
    Date.UTC(npt.getUTCFullYear(), npt.getUTCMonth(), npt.getUTCDate(), 0, 0, 0, 0) - NPT_OFFSET_MS
  );
  const last7Start = new Date(
    Date.UTC(npt.getUTCFullYear(), npt.getUTCMonth(), npt.getUTCDate() - 6, 0, 0, 0, 0) - NPT_OFFSET_MS
  );
  const monthStart = new Date(
    Date.UTC(npt.getUTCFullYear(), npt.getUTCMonth(), 1, 0, 0, 0, 0) - NPT_OFFSET_MS
  );

  return { todayStart, last7Start, monthStart, nowUTC };
}

class StoreReportService {
  async getSummary(owner_id) {
    try {
      const { todayStart, last7Start, monthStart, nowUTC } = getNPTRanges();

      const rows = await prisma.$queryRaw`
        WITH sale_stats AS (
          SELECT
            ss.sales_id,
            ss.created_at,
            GREATEST(ss.total_amount - COALESCE(ss.discount, 0), 0) AS effective_total,
            ss.paid_amount,
            COALESCE(SUM(COALESCE(ssi.cp, 0) * ssi.qty), 0) AS sold_cost
          FROM store_sales ss
          LEFT JOIN store_sales_items ssi ON ssi.sales_id = ss.sales_id
          WHERE ss.owner_id = ${owner_id}
          GROUP BY ss.sales_id, ss.total_amount, ss.discount, ss.paid_amount, ss.created_at
        ),
        return_stats AS (
          SELECT
            scr.sales_id,
            scr.created_at,
            SUM(scr.refund_amount) AS total_refund,
            SUM(COALESCE(
              (
                SELECT SUM(COALESCE(ssi.cp, 0) * scri.qty)
                FROM store_customer_return_items scri
                JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
                WHERE scri.return_id = scr.return_id
              ),
              0
            )) AS returned_cost
          FROM store_customer_returns scr
          WHERE scr.owner_id = ${owner_id}
          GROUP BY scr.sales_id, scr.created_at
        )
        SELECT
          -- Today
          COALESCE(COUNT(CASE WHEN s.created_at >= ${todayStart} THEN s.sales_id END), 0)::int AS today_sales_count,
          COALESCE(SUM(CASE WHEN s.created_at >= ${todayStart} THEN s.effective_total END), 0)::numeric AS today_effective_total,
          COALESCE(SUM(CASE WHEN s.created_at >= ${todayStart} THEN s.paid_amount END), 0)::numeric AS today_total_paid,
          COALESCE(SUM(CASE WHEN s.created_at >= ${todayStart} THEN s.effective_total END), 0)::numeric - COALESCE(SUM(CASE WHEN r.created_at >= ${todayStart} THEN r.total_refund END), 0)::numeric AS today_actual_revenue,
          COALESCE(SUM(CASE WHEN s.created_at >= ${todayStart} THEN s.sold_cost END), 0)::numeric - COALESCE(SUM(CASE WHEN r.created_at >= ${todayStart} THEN r.returned_cost END), 0)::numeric AS today_net_cost,
          COALESCE(SUM(CASE WHEN r.created_at >= ${todayStart} THEN r.total_refund END), 0)::numeric AS today_total_refund,

          -- Last 7 Days
          COALESCE(COUNT(CASE WHEN s.created_at >= ${last7Start} THEN s.sales_id END), 0)::int AS last_7_sales_count,
          COALESCE(SUM(CASE WHEN s.created_at >= ${last7Start} THEN s.effective_total END), 0)::numeric AS last_7_effective_total,
          COALESCE(SUM(CASE WHEN s.created_at >= ${last7Start} THEN s.paid_amount END), 0)::numeric AS last_7_total_paid,
          COALESCE(SUM(CASE WHEN s.created_at >= ${last7Start} THEN s.effective_total END), 0)::numeric - COALESCE(SUM(CASE WHEN r.created_at >= ${last7Start} THEN r.total_refund END), 0)::numeric AS last_7_actual_revenue,
          COALESCE(SUM(CASE WHEN s.created_at >= ${last7Start} THEN s.sold_cost END), 0)::numeric - COALESCE(SUM(CASE WHEN r.created_at >= ${last7Start} THEN r.returned_cost END), 0)::numeric AS last_7_net_cost,
          COALESCE(SUM(CASE WHEN r.created_at >= ${last7Start} THEN r.total_refund END), 0)::numeric AS last_7_total_refund,

          -- This Month
          COALESCE(COUNT(CASE WHEN s.created_at >= ${monthStart} THEN s.sales_id END), 0)::int AS month_sales_count,
          COALESCE(SUM(CASE WHEN s.created_at >= ${monthStart} THEN s.effective_total END), 0)::numeric AS month_effective_total,
          COALESCE(SUM(CASE WHEN s.created_at >= ${monthStart} THEN s.paid_amount END), 0)::numeric AS month_total_paid,
          COALESCE(SUM(CASE WHEN s.created_at >= ${monthStart} THEN s.effective_total END), 0)::numeric - COALESCE(SUM(CASE WHEN r.created_at >= ${monthStart} THEN r.total_refund END), 0)::numeric AS month_actual_revenue,
          COALESCE(SUM(CASE WHEN s.created_at >= ${monthStart} THEN s.sold_cost END), 0)::numeric - COALESCE(SUM(CASE WHEN r.created_at >= ${monthStart} THEN r.returned_cost END), 0)::numeric AS month_net_cost,
          COALESCE(SUM(CASE WHEN r.created_at >= ${monthStart} THEN r.total_refund END), 0)::numeric AS month_total_refund,

          -- All Time
          COALESCE(COUNT(s.sales_id), 0)::int AS all_sales_count,
          COALESCE(SUM(s.effective_total), 0)::numeric AS all_effective_total,
          COALESCE(SUM(s.paid_amount), 0)::numeric AS all_total_paid,
          COALESCE(SUM(s.effective_total), 0)::numeric - COALESCE(SUM(r.total_refund), 0)::numeric AS all_actual_revenue,
          COALESCE(SUM(s.sold_cost), 0)::numeric - COALESCE(SUM(r.returned_cost), 0)::numeric AS all_net_cost,
          COALESCE(SUM(r.total_refund), 0)::numeric AS all_total_refund,

          -- Expenses
          (SELECT COALESCE(SUM(amount), 0)::numeric FROM store_expenses WHERE owner_id = ${owner_id} AND created_at >= ${todayStart}) AS today_expenses,
          (SELECT COALESCE(SUM(amount), 0)::numeric FROM store_expenses WHERE owner_id = ${owner_id} AND created_at >= ${last7Start}) AS last_7_expenses,
          (SELECT COALESCE(SUM(amount), 0)::numeric FROM store_expenses WHERE owner_id = ${owner_id} AND created_at >= ${monthStart}) AS month_expenses,
          (SELECT COALESCE(SUM(amount), 0)::numeric FROM store_expenses WHERE owner_id = ${owner_id}) AS all_expenses,

          -- Total Due
          (SELECT COALESCE(SUM(due_amount), 0)::numeric FROM store_sales WHERE owner_id = ${owner_id} AND due_amount > 0) AS total_due
        FROM (SELECT 1) d
        LEFT JOIN sale_stats s ON true
        LEFT JOIN return_stats r ON r.sales_id = s.sales_id
      `;

      const res = rows[0] || {};
      const totalDue = Number(res.total_due || 0);

      const todayRevenue = Number(res.today_actual_revenue || 0);
      const todayNetCost = Number(res.today_net_cost || 0);
      const todayExpenses = Number(res.today_expenses || 0);
      const todayProfit = todayRevenue - todayNetCost - todayExpenses;

      const last7Revenue = Number(res.last_7_actual_revenue || 0);
      const last7NetCost = Number(res.last_7_net_cost || 0);
      const last7Expenses = Number(res.last_7_expenses || 0);
      const last7Profit = last7Revenue - last7NetCost - last7Expenses;

      const monthRevenue = Number(res.month_actual_revenue || 0);
      const monthNetCost = Number(res.month_net_cost || 0);
      const monthExpenses = Number(res.month_expenses || 0);
      const monthProfit = monthRevenue - monthNetCost - monthExpenses;

      const allRevenue = Number(res.all_actual_revenue || 0);
      const allNetCost = Number(res.all_net_cost || 0);
      const allExpenses = Number(res.all_expenses || 0);
      const allProfit = allRevenue - allNetCost - allExpenses;

      return {
        today: {
          sales_count: Number(res.today_sales_count || 0),
          sales: Number(todayRevenue.toFixed(2)),
          gross_sales: Number(res.today_effective_total || 0),
          actual_revenue: Number(todayRevenue.toFixed(2)),
          total_refund: Number(Number(res.today_total_refund || 0).toFixed(2)),
          total_cost: Number(todayNetCost.toFixed(2)),
          total_paid: Number(Number(res.today_total_paid || 0).toFixed(2)),
          expenses: Number(todayExpenses.toFixed(2)),
          profit: Number(todayProfit.toFixed(2)),
          total_due: totalDue,
        },
        last_7_days: {
          sales_count: Number(res.last_7_sales_count || 0),
          sales: Number(last7Revenue.toFixed(2)),
          gross_sales: Number(res.last_7_effective_total || 0),
          actual_revenue: Number(last7Revenue.toFixed(2)),
          total_refund: Number(Number(res.last_7_total_refund || 0).toFixed(2)),
          total_cost: Number(last7NetCost.toFixed(2)),
          total_paid: Number(Number(res.last_7_total_paid || 0).toFixed(2)),
          expenses: Number(last7Expenses.toFixed(2)),
          profit: Number(last7Profit.toFixed(2)),
          total_due: totalDue,
        },
        this_month: {
          sales_count: Number(res.month_sales_count || 0),
          sales: Number(monthRevenue.toFixed(2)),
          gross_sales: Number(res.month_effective_total || 0),
          actual_revenue: Number(monthRevenue.toFixed(2)),
          total_refund: Number(Number(res.month_total_refund || 0).toFixed(2)),
          total_cost: Number(monthNetCost.toFixed(2)),
          total_paid: Number(Number(res.month_total_paid || 0).toFixed(2)),
          expenses: Number(monthExpenses.toFixed(2)),
          profit: Number(monthProfit.toFixed(2)),
          total_due: totalDue,
        },
        all_time: {
          sales_count: Number(res.all_sales_count || 0),
          sales: Number(allRevenue.toFixed(2)),
          gross_sales: Number(res.all_effective_total || 0),
          actual_revenue: Number(allRevenue.toFixed(2)),
          total_refund: Number(Number(res.all_total_refund || 0).toFixed(2)),
          total_cost: Number(allNetCost.toFixed(2)),
          total_paid: Number(Number(res.all_total_paid || 0).toFixed(2)),
          expenses: Number(allExpenses.toFixed(2)),
          profit: Number(allProfit.toFixed(2)),
          total_due: totalDue,
        },
      };
    } catch (err) {
      console.error("Error in optimized storeReportService.getSummary:", err);
      throw err;
    }
  }
}

export default new StoreReportService();
