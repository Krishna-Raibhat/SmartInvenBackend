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

class StoreDashboardReportService {
  async getSummary(owner_id) {
    const { todayStart, last7Start, monthStart, nowUTC } = getNPTRanges();

    const [
      salesToday, salesLast7, salesMonth, salesAll,
      expToday,   expLast7,   expMonth,   expAll,
      duesToday,  duesLast7,  duesMonth,  duesAll,
    ] = await Promise.all([
      // ── Sales ────────────────────────────────────────────────────
      prisma.$queryRaw`
        SELECT
          COALESCE(SUM(GREATEST(s.total_amount - COALESCE(s.discount,0), 0)), 0)::numeric AS net_sales,
          COALESCE(SUM(r.refund_amount), 0)::numeric AS refunds
        FROM store_sales s
        LEFT JOIN store_customer_returns r ON r.sales_id = s.sales_id
        WHERE s.owner_id = ${owner_id}
          AND s.created_at >= ${todayStart} AND s.created_at <= ${nowUTC}
      `,
      prisma.$queryRaw`
        SELECT
          COALESCE(SUM(GREATEST(s.total_amount - COALESCE(s.discount,0), 0)), 0)::numeric AS net_sales,
          COALESCE(SUM(r.refund_amount), 0)::numeric AS refunds
        FROM store_sales s
        LEFT JOIN store_customer_returns r ON r.sales_id = s.sales_id
        WHERE s.owner_id = ${owner_id}
          AND s.created_at >= ${last7Start} AND s.created_at <= ${nowUTC}
      `,
      prisma.$queryRaw`
        SELECT
          COALESCE(SUM(GREATEST(s.total_amount - COALESCE(s.discount,0), 0)), 0)::numeric AS net_sales,
          COALESCE(SUM(r.refund_amount), 0)::numeric AS refunds
        FROM store_sales s
        LEFT JOIN store_customer_returns r ON r.sales_id = s.sales_id
        WHERE s.owner_id = ${owner_id}
          AND s.created_at >= ${monthStart} AND s.created_at <= ${nowUTC}
      `,
      prisma.$queryRaw`
        SELECT
          COALESCE(SUM(GREATEST(s.total_amount - COALESCE(s.discount,0), 0)), 0)::numeric AS net_sales,
          COALESCE(SUM(r.refund_amount), 0)::numeric AS refunds
        FROM store_sales s
        LEFT JOIN store_customer_returns r ON r.sales_id = s.sales_id
        WHERE s.owner_id = ${owner_id}
      `,

      // ── Expenses ─────────────────────────────────────────────────
      prisma.$queryRaw`
        SELECT COALESCE(SUM(amount),0)::numeric AS total
        FROM store_expenses
        WHERE owner_id = ${owner_id}
          AND created_at >= ${todayStart} AND created_at <= ${nowUTC}
      `,
      prisma.$queryRaw`
        SELECT COALESCE(SUM(amount),0)::numeric AS total
        FROM store_expenses
        WHERE owner_id = ${owner_id}
          AND created_at >= ${last7Start} AND created_at <= ${nowUTC}
      `,
      prisma.$queryRaw`
        SELECT COALESCE(SUM(amount),0)::numeric AS total
        FROM store_expenses
        WHERE owner_id = ${owner_id}
          AND created_at >= ${monthStart} AND created_at <= ${nowUTC}
      `,
      prisma.$queryRaw`
        SELECT COALESCE(SUM(amount),0)::numeric AS total
        FROM store_expenses
        WHERE owner_id = ${owner_id}
      `,

      // ── Dues ─────────────────────────────────────────────────────
      prisma.$queryRaw`
        SELECT COALESCE(SUM(due_amount),0)::numeric AS total
        FROM store_sales
        WHERE owner_id = ${owner_id} AND due_amount > 0
          AND created_at >= ${todayStart} AND created_at <= ${nowUTC}
      `,
      prisma.$queryRaw`
        SELECT COALESCE(SUM(due_amount),0)::numeric AS total
        FROM store_sales
        WHERE owner_id = ${owner_id} AND due_amount > 0
          AND created_at >= ${last7Start} AND created_at <= ${nowUTC}
      `,
      prisma.$queryRaw`
        SELECT COALESCE(SUM(due_amount),0)::numeric AS total
        FROM store_sales
        WHERE owner_id = ${owner_id} AND due_amount > 0
          AND created_at >= ${monthStart} AND created_at <= ${nowUTC}
      `,
      prisma.$queryRaw`
        SELECT COALESCE(SUM(due_amount),0)::numeric AS total
        FROM store_sales
        WHERE owner_id = ${owner_id} AND due_amount > 0
      `,
    ]);

    const shape = (salesRow, expRow, duesRow) => {
      const sales    = Math.max(0, Number(salesRow[0]?.net_sales || 0) - Number(salesRow[0]?.refunds || 0));
      const expenses = Number(expRow[0]?.total || 0);
      const profit   = sales - expenses;
      return {
        sales:    Number(sales.toFixed(2)),
        expenses: Number(expenses.toFixed(2)),
        profit:   Number(profit.toFixed(2)),
        dues:     Number(Number(duesRow[0]?.total || 0).toFixed(2)),
      };
    };

    return {
      today:       shape(salesToday, expToday, duesToday),
      last_7_days: shape(salesLast7, expLast7, duesLast7),
      this_month:  shape(salesMonth, expMonth, duesMonth),
      all_time:    shape(salesAll,   expAll,   duesAll),
    };
  }
}

export default new StoreDashboardReportService();