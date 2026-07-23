// src/services/storeFinancialsService.js
//
// Single source of truth for the "revenue → refunds → COGS → expenses → profit"
// math shared by:
//   - storeReportService.js            (GET /api/store/reports/summary)
//   - storeSalesSummaryReportService.js (GET /api/store/sales-summary-reports/salesreport-summary)
//   - storeProfitReportService.js       (GET /api/store/reports/profit)
//
// Every number here is already net of customer returns (refunded revenue and
// the cost basis of returned items are both subtracted) so callers never have
// to re-derive that logic themselves.
import { prisma } from "../prisma/client.js";

class StoreFinancialsService {
  /**
   * Core totals for a single period: revenue, discount, refunds, COGS,
   * returned-item cost, expenses, and the resulting profit figures.
   * `from`/`to` must be Date objects (inclusive range).
   */
  async getCoreFinancials(owner_id, from, to) {
    const rows = await prisma.$queryRaw`
      WITH sold AS (
        SELECT
          ss.sales_id,
          ss.total_amount,
          ss.discount,
          ss.paid_amount,
          ss.due_amount,
          GREATEST(ss.total_amount - COALESCE(ss.discount, 0), 0) AS effective_total,
          COALESCE(SUM(COALESCE(ssi.cp, 0) * ssi.qty), 0) AS sold_cost
        FROM store_sales ss
        LEFT JOIN store_sales_items ssi ON ssi.sales_id = ss.sales_id
        WHERE ss.owner_id = ${owner_id}
          AND ss.created_at >= ${from}
          AND ss.created_at <= ${to}
        GROUP BY ss.sales_id, ss.total_amount, ss.discount, ss.paid_amount, ss.due_amount
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
            AND created_at >= ${from}
            AND created_at <= ${to}
          GROUP BY sales_id
        ) r_refund
        LEFT JOIN (
          SELECT scr.sales_id, SUM(COALESCE(ssi.cp, 0) * scri.qty) AS returned_cost
          FROM store_customer_returns scr
          JOIN store_customer_return_items scri ON scri.return_id = scr.return_id
          JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
          WHERE scr.owner_id = ${owner_id}
            AND scr.created_at >= ${from}
            AND scr.created_at <= ${to}
          GROUP BY scr.sales_id
        ) r_cost ON r_cost.sales_id = r_refund.sales_id
      ),
      expenses AS (
        SELECT COALESCE(SUM(amount), 0) AS total_expenses
        FROM store_expenses
        WHERE owner_id = ${owner_id}
          AND created_at >= ${from}
          AND created_at <= ${to}
          AND note NOT LIKE '%[SUPPLIER_PAYMENT:%'
      )
      SELECT
        COALESCE(COUNT(s.sales_id), 0)::int          AS order_count,
        COALESCE(SUM(s.total_amount), 0)::numeric     AS gross_revenue,
        COALESCE(SUM(s.discount), 0)::numeric         AS total_discount,
        COALESCE(SUM(s.effective_total), 0)::numeric  AS net_revenue,
        COALESCE(SUM(s.paid_amount), 0)::numeric      AS total_paid,
        COALESCE(SUM(s.due_amount), 0)::numeric       AS total_due_in_range,
        COALESCE(SUM(s.sold_cost), 0)::numeric        AS cogs,
        COALESCE(SUM(r.total_refund), 0)::numeric     AS total_refund,
        COALESCE(SUM(r.returned_cost), 0)::numeric    AS returned_cost,
        (SELECT total_expenses FROM expenses)::numeric AS total_expenses
      FROM sold s
      LEFT JOIN returns r ON r.sales_id = s.sales_id
    `;

    const r = rows[0] || {};
    const netRevenue = Number(r.net_revenue || 0);
    const totalRefund = Number(r.total_refund || 0);
    const cogs = Number(r.cogs || 0);
    const returnedCost = Number(r.returned_cost || 0);
    const totalExpenses = Number(r.total_expenses || 0);

    const actualRevenue = netRevenue - totalRefund;
    const netCost = cogs - returnedCost;
    const grossProfit = actualRevenue - netCost;
    const netProfit = grossProfit - totalExpenses;

    return {
      order_count: Number(r.order_count || 0),
      gross_revenue: Number(r.gross_revenue || 0),
      total_discount: Number(r.total_discount || 0),
      net_revenue: netRevenue,
      total_paid: Number(r.total_paid || 0),
      total_due_in_range: Number(r.total_due_in_range || 0),
      cogs,
      total_refund: totalRefund,
      returned_cost: returnedCost,
      total_expenses: totalExpenses,
      actual_revenue: actualRevenue,
      net_cost: netCost,
      gross_profit: grossProfit,
      net_profit: netProfit,
    };
  }

  /** All-time outstanding due across every sale, regardless of date. */
  async getOutstandingDue(owner_id) {
    const rows = await prisma.$queryRaw`
      SELECT COALESCE(SUM(due_amount), 0)::numeric AS total_due
      FROM store_sales
      WHERE owner_id = ${owner_id} AND due_amount > 0
    `;
    return Number(rows[0]?.total_due || 0);
  }

  /** Per-day revenue and COGS, both net of returns (day of the original sale). */
  async getDailyTrend(owner_id, from, to) {
    const rows = await prisma.$queryRaw`
      WITH daily_sold AS (
        SELECT
          DATE(ss.created_at) AS day,
          ss.sales_id,
          GREATEST(ss.total_amount - COALESCE(ss.discount, 0), 0) AS effective_total,
          COALESCE(SUM(COALESCE(ssi.cp, 0) * ssi.qty), 0) AS sold_cost
        FROM store_sales ss
        LEFT JOIN store_sales_items ssi ON ssi.sales_id = ss.sales_id
        WHERE ss.owner_id = ${owner_id}
          AND ss.created_at >= ${from}
          AND ss.created_at <= ${to}
        GROUP BY ss.sales_id, ss.created_at, ss.total_amount, ss.discount
      ),
      daily_returns AS (
        SELECT
          r_refund.sales_id,
          r_refund.total_refund,
          COALESCE(r_cost.returned_cost, 0) AS returned_cost
        FROM (
          SELECT sales_id, SUM(refund_amount) AS total_refund
          FROM store_customer_returns
          WHERE owner_id = ${owner_id}
            AND created_at >= ${from}
            AND created_at <= ${to}
          GROUP BY sales_id
        ) r_refund
        LEFT JOIN (
          SELECT scr.sales_id, SUM(COALESCE(ssi.cp, 0) * scri.qty) AS returned_cost
          FROM store_customer_returns scr
          JOIN store_customer_return_items scri ON scri.return_id = scr.return_id
          JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
          WHERE scr.owner_id = ${owner_id}
            AND scr.created_at >= ${from}
            AND scr.created_at <= ${to}
          GROUP BY scr.sales_id
        ) r_cost ON r_cost.sales_id = r_refund.sales_id
      )
      SELECT
        ds.day,
        COALESCE(SUM(ds.effective_total), 0) - COALESCE(SUM(dr.total_refund), 0)  AS revenue,
        COALESCE(SUM(ds.sold_cost), 0)       - COALESCE(SUM(dr.returned_cost), 0) AS cogs
      FROM daily_sold ds
      LEFT JOIN daily_returns dr ON dr.sales_id = ds.sales_id
      GROUP BY ds.day
      ORDER BY ds.day ASC
    `;

    return rows.map((row) => ({
      date: (row.day instanceof Date ? row.day.toISOString() : String(row.day)).slice(0, 10),
      revenue: Number(row.revenue) || 0,
      cogs: Number(row.cogs) || 0,
    }));
  }

  /**
   * Per-product revenue/COGS/profit for the period, net of returns.
   * Callers sort/slice/filter as needed (top by revenue, top by profit, etc).
   */
  async getProductBreakdown(owner_id, from, to) {
    const rows = await prisma.$queryRaw`
      WITH sold_items AS (
        SELECT
          si.product_id,
          p.product_name,
          COALESCE(c.category_name, 'Uncategorized') AS category_name,
          COALESCE(p.cp, 0) AS cp,
          COALESCE(p.sp, 0) AS sp,
          si.sales_item_id,
          si.qty AS sold_qty,
          si.line_total,
          COALESCE(si.cp, 0) * si.qty AS sold_cost
        FROM store_sales_items si
        JOIN store_sales s ON s.sales_id = si.sales_id
        JOIN store_products p ON p.product_id = si.product_id
        LEFT JOIN store_categories c ON c.category_id = p.category_id
        WHERE s.owner_id = ${owner_id}
          AND s.created_at >= ${from}
          AND s.created_at <= ${to}
      ),
      returned_items AS (
        SELECT
          scri.sales_item_id,
          SUM(scri.qty) AS returned_qty,
          SUM(COALESCE(si2.cp, 0) * scri.qty) AS returned_cost,
          SUM(si2.sp * scri.qty) AS returned_revenue
        FROM store_customer_return_items scri
        JOIN store_customer_returns scr ON scr.return_id = scri.return_id
        JOIN store_sales_items si2 ON si2.sales_item_id = scri.sales_item_id
        WHERE scr.owner_id = ${owner_id}
          AND scr.created_at >= ${from}
          AND scr.created_at <= ${to}
        GROUP BY scri.sales_item_id
      )
      SELECT
        si.product_id,
        si.product_name,
        si.category_name,
        si.cp,
        si.sp,
        SUM(si.sold_qty) - COALESCE(SUM(ri.returned_qty), 0) AS qty,
        COALESCE(SUM(si.line_total), 0) - COALESCE(SUM(ri.returned_revenue), 0) AS revenue,
        COALESCE(SUM(si.sold_cost), 0) - COALESCE(SUM(ri.returned_cost), 0) AS cogs
      FROM sold_items si
      LEFT JOIN returned_items ri ON ri.sales_item_id = si.sales_item_id
      GROUP BY si.product_id, si.product_name, si.category_name, si.cp, si.sp
    `;

    return rows.map((r) => {
      const revenue = Number(r.revenue) || 0;
      const cogs = Number(r.cogs) || 0;
      const profit = revenue - cogs;
      return {
        product_id: r.product_id,
        product_name: r.product_name,
        category_name: r.category_name,
        cp: Number(r.cp) || 0,
        sp: Number(r.sp) || 0,
        qty: Number(r.qty) || 0,
        revenue,
        cogs,
        profit,
        margin: revenue > 0 ? (profit / revenue) * 100 : 0,
      };
    });
  }

  /** Per-category revenue/COGS/profit for the period, net of returns. */
  async getCategoryBreakdown(owner_id, from, to) {
    const rows = await prisma.$queryRaw`
      WITH sold_items AS (
        SELECT
          p.category_id,
          COALESCE(c.category_name, 'Uncategorized') AS category_name,
          si.sales_item_id,
          si.qty AS sold_qty,
          si.line_total,
          COALESCE(si.cp, 0) * si.qty AS sold_cost
        FROM store_sales_items si
        JOIN store_sales s ON s.sales_id = si.sales_id
        JOIN store_products p ON p.product_id = si.product_id
        LEFT JOIN store_categories c ON c.category_id = p.category_id
        WHERE s.owner_id = ${owner_id}
          AND s.created_at >= ${from}
          AND s.created_at <= ${to}
      ),
      returned_items AS (
        SELECT
          scri.sales_item_id,
          SUM(scri.qty) AS returned_qty,
          SUM(COALESCE(si2.cp, 0) * scri.qty) AS returned_cost,
          SUM(si2.sp * scri.qty) AS returned_revenue
        FROM store_customer_return_items scri
        JOIN store_customer_returns scr ON scr.return_id = scri.return_id
        JOIN store_sales_items si2 ON si2.sales_item_id = scri.sales_item_id
        WHERE scr.owner_id = ${owner_id}
          AND scr.created_at >= ${from}
          AND scr.created_at <= ${to}
        GROUP BY scri.sales_item_id
      )
      SELECT
        si.category_id,
        si.category_name,
        SUM(si.sold_qty) - COALESCE(SUM(ri.returned_qty), 0) AS qty,
        COALESCE(SUM(si.line_total), 0) - COALESCE(SUM(ri.returned_revenue), 0) AS revenue,
        COALESCE(SUM(si.sold_cost), 0) - COALESCE(SUM(ri.returned_cost), 0) AS cogs
      FROM sold_items si
      LEFT JOIN returned_items ri ON ri.sales_item_id = si.sales_item_id
      GROUP BY si.category_id, si.category_name
    `;

    return rows.map((r) => {
      const revenue = Number(r.revenue) || 0;
      const cogs = Number(r.cogs) || 0;
      const profit = revenue - cogs;
      return {
        category_id: r.category_id,
        category_name: r.category_name,
        qty: Number(r.qty) || 0,
        revenue,
        cogs,
        profit,
        margin: revenue > 0 ? (profit / revenue) * 100 : 0,
      };
    });
  }

  /** Payment status counts + revenue split by cash/online for the period. */
  async getPaymentBreakdown(owner_id, from, to) {
    const [statusRows, methodRows] = await Promise.all([
      prisma.$queryRaw`
        SELECT payment_status, COUNT(*)::int AS count
        FROM store_sales
        WHERE owner_id = ${owner_id}
          AND created_at >= ${from}
          AND created_at <= ${to}
        GROUP BY payment_status
      `,
      prisma.$queryRaw`
        SELECT payment_method, COALESCE(SUM(total_amount - discount), 0)::numeric AS amount
        FROM store_sales
        WHERE owner_id = ${owner_id}
          AND created_at >= ${from}
          AND created_at <= ${to}
        GROUP BY payment_method
      `,
    ]);

    const statusCounts = { paid: 0, partial: 0, pending: 0 };
    for (const row of statusRows) {
      if (statusCounts[row.payment_status] !== undefined) {
        statusCounts[row.payment_status] = Number(row.count);
      }
    }

    let cashRevenue = 0;
    let onlineRevenue = 0;
    for (const row of methodRows) {
      if (row.payment_method === "cash") cashRevenue = Number(row.amount);
      if (row.payment_method === "online") onlineRevenue = Number(row.amount);
    }

    return { statusCounts, cashRevenue, onlineRevenue };
  }

  /** Expense breakdown by title for the period. `totalExpenses` is used to compute each `pct`. */
  async getExpenseBreakdown(owner_id, from, to, totalExpenses) {
    const rows = await prisma.$queryRaw`
      SELECT t.title, SUM(se.amount)::numeric AS amount
      FROM store_expenses se
      JOIN store_expense_titles t ON t.title_id = se.title_id
      WHERE se.owner_id = ${owner_id}
        AND se.created_at >= ${from}
        AND se.created_at <= ${to}
        AND se.note NOT LIKE '%[SUPPLIER_PAYMENT:%'
      GROUP BY t.title_id, t.title
      ORDER BY amount DESC
    `;

    return rows.map((e) => ({
      title: e.title,
      amount: Number(e.amount) || 0,
      pct: totalExpenses > 0 ? (Number(e.amount) / totalExpenses) * 100 : 0,
    }));
  }

  /** Most recent N sales in the period, net amount after any returns against them. */
  async getRecentSales(owner_id, from, to, limit) {
    const rows = await prisma.$queryRaw`
      WITH recent_sales_base AS (
        SELECT
          ss.sales_id,
          ss.total_amount,
          ss.discount,
          ss.payment_status,
          ss.created_at,
          c.full_name AS customer_name,
          GREATEST(ss.total_amount - COALESCE(ss.discount, 0), 0) AS effective_total
        FROM store_sales ss
        LEFT JOIN customers c ON c.customer_id = ss.customer_id
        WHERE ss.owner_id = ${owner_id}
          AND ss.created_at >= ${from}
          AND ss.created_at <= ${to}
        ORDER BY ss.created_at DESC
        LIMIT ${limit}
      ),
      sale_returns AS (
        SELECT sales_id, COALESCE(SUM(refund_amount), 0) AS total_refund
        FROM store_customer_returns
        WHERE owner_id = ${owner_id}
        GROUP BY sales_id
      )
      SELECT
        rsb.sales_id,
        rsb.customer_name,
        rsb.payment_status,
        rsb.created_at,
        rsb.effective_total - COALESCE(sr.total_refund, 0) AS net_amount
      FROM recent_sales_base rsb
      LEFT JOIN sale_returns sr ON sr.sales_id = rsb.sales_id
      ORDER BY rsb.created_at DESC
    `;

    return rows.map((sale) => ({
      sales_id: sale.sales_id,
      customer_name: sale.customer_name || "Walk-in Customer",
      date: sale.created_at,
      amount: Number(sale.net_amount || 0),
      status: sale.payment_status,
    }));
  }
}

export default new StoreFinancialsService();
