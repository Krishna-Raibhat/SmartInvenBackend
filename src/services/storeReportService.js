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
    const { todayStart, last7Start, monthStart, nowUTC } = getNPTRanges();

    const periods = [
      { key: "today",       start: todayStart },
      { key: "last_7_days", start: last7Start },
      { key: "this_month",  start: monthStart },
      { key: "all_time",    start: null },
    ];

    const [periodResults, duesRow] = await Promise.all([
      Promise.all(periods.map((p) => this._getPeriodStats(owner_id, p.start, nowUTC))),
      prisma.$queryRaw`
        SELECT COALESCE(SUM(due_amount), 0)::numeric AS total
        FROM store_sales
        WHERE owner_id = ${owner_id} AND due_amount > 0
      `,
    ]);

    const totalDue = Number(Number(duesRow[0]?.total || 0).toFixed(2));

    const results = {};
    periods.forEach((p, i) => {
      results[p.key] = { ...periodResults[i], total_due: totalDue };
    });

    return results;
  }

  async _getPeriodStats(owner_id, startDate, endDate) {
    const hasDate = !!startDate;

    // Single consolidated query per period — matches clothing logic exactly
    const [profitRows, refundRows, expenseRows] = await Promise.all([
      hasDate
        ? prisma.$queryRaw`
            WITH sales_in_period AS (
              SELECT sales_id
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
            )
            SELECT
              COALESCE(SUM(s.effective_total), 0) - COALESCE(SUM(r.total_refund),  0) AS actual_revenue,
              COALESCE(SUM(s.sold_cost),       0) - COALESCE(SUM(r.returned_cost), 0) AS net_cost,
              COALESCE(SUM(r.total_refund),    0)                                      AS total_refund
            FROM sold s
            LEFT JOIN returns r ON r.sales_id = s.sales_id
          `
        : prisma.$queryRaw`
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
                SELECT sales_id, SUM(refund_amount) AS total_refund
                FROM store_customer_returns
                WHERE owner_id = ${owner_id}
                GROUP BY sales_id
              ) r_refund
              LEFT JOIN (
                SELECT scr.sales_id, SUM(COALESCE(ssi.cp, 0) * scri.qty) AS returned_cost
                FROM store_customer_returns scr
                JOIN store_customer_return_items scri ON scri.return_id = scri.return_id
                JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
                WHERE scr.owner_id = ${owner_id}
                GROUP BY scr.sales_id
              ) r_cost ON r_cost.sales_id = r_refund.sales_id
            )
            SELECT
              COALESCE(SUM(s.effective_total), 0) - COALESCE(SUM(r.total_refund),  0) AS actual_revenue,
              COALESCE(SUM(s.sold_cost),       0) - COALESCE(SUM(r.returned_cost), 0) AS net_cost,
              COALESCE(SUM(r.total_refund),    0)                                      AS total_refund
            FROM sold s
            LEFT JOIN returns r ON r.sales_id = s.sales_id
          `,

      // Sales count + paid separately (simpler query)
      hasDate
        ? prisma.$queryRaw`
            SELECT
              COUNT(sales_id)::int                                                       AS sales_count,
              COALESCE(SUM(GREATEST(total_amount - COALESCE(discount,0),0)),0)::numeric AS effective_total,
              COALESCE(SUM(paid_amount), 0)::numeric                                    AS total_paid
            FROM store_sales
            WHERE owner_id = ${owner_id}
              AND created_at >= ${startDate}
              AND created_at <= ${endDate}
          `
        : prisma.$queryRaw`
            SELECT
              COUNT(sales_id)::int                                                       AS sales_count,
              COALESCE(SUM(GREATEST(total_amount - COALESCE(discount,0),0)),0)::numeric AS effective_total,
              COALESCE(SUM(paid_amount), 0)::numeric                                    AS total_paid
            FROM store_sales
            WHERE owner_id = ${owner_id}
          `,
      
      // Get expenses for the period
      hasDate
        ? prisma.$queryRaw`
            SELECT COALESCE(SUM(amount), 0)::numeric AS total_expenses
            FROM store_expenses
            WHERE owner_id = ${owner_id}
              AND created_at >= ${startDate}
              AND created_at <= ${endDate}
          `
        : prisma.$queryRaw`
            SELECT COALESCE(SUM(amount), 0)::numeric AS total_expenses
            FROM store_expenses
            WHERE owner_id = ${owner_id}
          `,
    ]);

    const pr = profitRows[0] || {};
    const sr = refundRows[0] || {};
    const er = expenseRows[0] || {};

    const actualRevenue = Number(pr.actual_revenue || 0);
    const netCost       = Number(pr.net_cost       || 0);
    const totalRefund   = Number(pr.total_refund   || 0);
    const totalExpenses = Number(er.total_expenses || 0);
    const profit        = actualRevenue - netCost - totalExpenses;

    return {
      sales_count:    Number(sr.sales_count    || 0),
      sales:          Number(actualRevenue.toFixed(2)),
      gross_sales:    Number(sr.effective_total|| 0),
      actual_revenue: Number(actualRevenue.toFixed(2)),
      total_refund:   Number(totalRefund.toFixed(2)),
      total_cost:     Number(netCost.toFixed(2)),
      total_paid:     Number(Number(sr.total_paid || 0).toFixed(2)),
      expenses:       Number(totalExpenses.toFixed(2)),
      profit:         Number(profit.toFixed(2)),
    };
  }
}

export default new StoreReportService();
