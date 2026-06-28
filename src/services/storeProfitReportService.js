
import { prisma } from "../prisma/client.js";

/**
 * Store Profit Report Service
 * 
 * Provides comprehensive profit analysis including:
 * - Financial summary with growth metrics
 * - Top profitable items
 * - Expense breakdown
 * - Profit by category
 * - Monthly and daily P&L trends
 */

class StoreProfitReportService {
  /**
   * Get comprehensive profit report for date range
   */
  async getReport(owner_id, { from, to }) {
    console.log('📊 Generating profit report for owner:', owner_id, 'from:', from, 'to:', to);

    // Get current period stats
    const current = await this._getPeriodStats(owner_id, from, to);

    // Get previous period stats for growth calculations
    const days = this._daysBetween(from, to);
    const prevTo = this._subtractDays(from, 1);
    const prevFrom = this._subtractDays(prevTo, days);
    const previous = await this._getPeriodStats(owner_id, prevFrom, prevTo);

    // Calculate growth metrics
    const summary = this._buildSummary(current, previous);

    // Get expense breakdown
    const expenseBreakdown = await this._getExpenseBreakdown(
      owner_id,
      from,
      to,
      current.total_expenses
    );
    summary.expense_breakdown = expenseBreakdown;

    // Get detailed breakdowns
    const [topItems, categories, monthly, daily] = await Promise.all([
      this._getTopProfitableItems(owner_id, from, to),
      this._getProfitByCategory(owner_id, from, to),
      this._getMonthlyTrend(owner_id),
      this._getDailyTrend(owner_id, from, to),
    ]);

    return {
      summary,
      top_profitable_items: topItems,
      profit_by_category: categories,
      monthly,
      daily,
    };
  }

  /**
   * Get financial stats for a period
   */
  async _getPeriodStats(owner_id, from, to) {
    const result = await prisma.$queryRaw`
      WITH sales_data AS (
        SELECT
          COALESCE(SUM(gross_revenue), 0) AS gross_revenue,
          COALESCE(SUM(total_discount), 0) AS total_discount,
          COALESCE(SUM(net_revenue), 0) AS net_revenue,
          COALESCE(SUM(cogs), 0) AS cogs
        FROM (
          SELECT
            ss.sales_id,
            ss.total_amount AS gross_revenue,
            ss.discount AS total_discount,
            GREATEST(ss.total_amount - COALESCE(ss.discount, 0), 0) AS net_revenue,
            COALESCE(SUM(ssi.cp * ssi.qty), 0) AS cogs
          FROM store_sales ss
          LEFT JOIN store_sales_items ssi ON ssi.sales_id = ss.sales_id
          WHERE ss.owner_id = ${owner_id}
            AND DATE(ss.created_at) >= ${from}::date
            AND DATE(ss.created_at) <= ${to}::date
          GROUP BY ss.sales_id, ss.total_amount, ss.discount
        ) AS sales_aggregated
      ),
      returns_data AS (
        SELECT
          COALESCE(SUM(scr.refund_amount), 0) AS total_refunds
        FROM store_customer_returns scr
        WHERE scr.owner_id = ${owner_id}
          AND DATE(scr.created_at) >= ${from}::date
          AND DATE(scr.created_at) <= ${to}::date
      ),
      expense_data AS (
        SELECT
          COALESCE(SUM(se.amount), 0) AS total_expenses
        FROM store_expenses se
        WHERE se.owner_id = ${owner_id}
          AND DATE(se.created_at) >= ${from}::date
          AND DATE(se.created_at) <= ${to}::date
      )
      SELECT
        sd.gross_revenue,
        sd.total_discount,
        sd.net_revenue,
        sd.cogs,
        rd.total_refunds AS refunds,
        ed.total_expenses,
        (sd.net_revenue - sd.cogs) AS gross_profit,
        (sd.net_revenue - sd.cogs - ed.total_expenses) AS net_profit
      FROM sales_data sd, returns_data rd, expense_data ed
    `;

    const row = result[0] || {};
    return {
      gross_revenue: Number(row.gross_revenue) || 0,
      total_discount: Number(row.total_discount) || 0,
      net_revenue: Number(row.net_revenue) || 0,
      cogs: Number(row.cogs) || 0,
      refunds: Number(row.refunds) || 0,
      total_expenses: Number(row.total_expenses) || 0,
      gross_profit: Number(row.gross_profit) || 0,
      net_profit: Number(row.net_profit) || 0,
    };
  }

  /**
   * Build summary with growth metrics
   */
  _buildSummary(current, previous) {
    const summary = { ...current };

    // Calculate margins and ratios
    summary.gross_margin = current.net_revenue > 0
      ? (current.gross_profit / current.net_revenue * 100)
      : 0;
    summary.net_margin = current.net_revenue > 0
      ? (current.net_profit / current.net_revenue * 100)
      : 0;
    summary.expense_ratio = current.net_revenue > 0
      ? (current.total_expenses / current.net_revenue * 100)
      : 0;
    summary.cogs_ratio = current.net_revenue > 0
      ? (current.cogs / current.net_revenue * 100)
      : 0;

    // Calculate growth vs previous period
    summary.revenue_growth = this._calcGrowth(
      current.net_revenue,
      previous.net_revenue
    );
    summary.profit_growth = this._calcGrowth(
      current.net_profit,
      previous.net_profit
    );
    summary.expense_growth = this._calcGrowth(
      current.total_expenses,
      previous.total_expenses
    );

    // Margin change in percentage points
    const prevMargin = previous.net_revenue > 0
      ? (previous.net_profit / previous.net_revenue * 100)
      : 0;
    summary.margin_change = summary.net_margin - prevMargin;

    return summary;
  }

  /**
   * Get expense breakdown by title
   */
  async _getExpenseBreakdown(owner_id, from, to, total_expenses) {
    const expenses = await prisma.$queryRaw`
      SELECT
        t.title,
        SUM(se.amount) AS amount
      FROM store_expenses se
      JOIN store_expense_titles t ON t.title_id = se.title_id
      WHERE se.owner_id = ${owner_id}
        AND se.created_at >= ${from}
        AND se.created_at <= ${to}
      GROUP BY t.title_id, t.title
      ORDER BY amount DESC
    `;

    return expenses.map(e => ({
      title: e.title,
      amount: Number(e.amount),
      pct: total_expenses > 0 ? (Number(e.amount) / total_expenses * 100) : 0,
    }));
  }

  /**
   * Get top 5 most profitable items
   */
  async _getTopProfitableItems(owner_id, from, to) {
    const items = await prisma.$queryRaw`
      SELECT
        sp.product_name AS name,
        SUM(ssi.sp * ssi.qty) AS revenue,
        SUM(ssi.cp * ssi.qty) AS cogs,
        SUM(ssi.sp * ssi.qty) - SUM(ssi.cp * ssi.qty) AS profit,
        SUM(ssi.qty) AS qty
      FROM store_sales_items ssi
      INNER JOIN store_sales ss ON ss.sales_id = ssi.sales_id
      INNER JOIN store_products sp ON sp.product_id = ssi.product_id
      WHERE ss.owner_id = ${owner_id}
        AND ss.created_at >= ${from}
        AND ss.created_at <= ${to}
      GROUP BY sp.product_id, sp.product_name
      HAVING SUM(ssi.sp * ssi.qty) - SUM(ssi.cp * ssi.qty) > 0
      ORDER BY profit DESC
      LIMIT 5
    `;

    return items.map(item => {
      const revenue = Number(item.revenue) || 0;
      const cogs = Number(item.cogs) || 0;
      const profit = Number(item.profit) || 0;
      return {
        name: item.name,
        revenue,
        cogs,
        profit,
        margin: revenue > 0 ? (profit / revenue * 100) : 0,
        qty: Number(item.qty) || 0,
      };
    });
  }

  /**
   * Get profit breakdown by category
   */
  async _getProfitByCategory(owner_id, from, to) {
    const categories = await prisma.$queryRaw`
      SELECT
        COALESCE(c.category_name, 'Uncategorized') AS name,
        SUM(ssi.sp * ssi.qty) AS revenue,
        SUM(ssi.sp * ssi.qty) - SUM(ssi.cp * ssi.qty) AS profit
      FROM store_sales_items ssi
      INNER JOIN store_sales ss ON ss.sales_id = ssi.sales_id
      INNER JOIN store_products sp ON sp.product_id = ssi.product_id
      LEFT JOIN store_categories c ON c.category_id = sp.category_id
      WHERE ss.owner_id = ${owner_id}
        AND ss.created_at >= ${from}
        AND ss.created_at <= ${to}
      GROUP BY c.category_id, c.category_name
      HAVING SUM(ssi.sp * ssi.qty) - SUM(ssi.cp * ssi.qty) > 0
      ORDER BY profit DESC
    `;

    return categories.map(cat => {
      const revenue = Number(cat.revenue) || 0;
      const profit = Number(cat.profit) || 0;
      return {
        name: cat.name,
        revenue,
        profit,
        margin: revenue > 0 ? (profit / revenue * 100) : 0,
      };
    });
  }

  /**
   * Get last 6 months P&L trend
   */
  async _getMonthlyTrend(owner_id) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setDate(1); // Start from first day of the month
    const fromDate = sixMonthsAgo.toISOString().split('T')[0];

    const months = await prisma.$queryRaw`
      SELECT
        m,
        y,
        mon,
        COALESCE(SUM(net_revenue), 0) AS revenue,
        COALESCE(SUM(cogs), 0) AS cogs
      FROM (
        SELECT
          ss.sales_id,
          TO_CHAR(ss.created_at, 'Mon') AS m,
          EXTRACT(YEAR FROM ss.created_at)::int AS y,
          EXTRACT(MONTH FROM ss.created_at)::int AS mon,
          GREATEST(ss.total_amount - COALESCE(ss.discount, 0), 0) AS net_revenue,
          COALESCE(SUM(ssi.cp * ssi.qty), 0) AS cogs
        FROM store_sales ss
        LEFT JOIN store_sales_items ssi ON ssi.sales_id = ss.sales_id
        WHERE ss.owner_id = ${owner_id}
          AND ss.created_at >= ${fromDate}::date
        GROUP BY ss.sales_id, ss.created_at, ss.total_amount, ss.discount
      ) AS aggregated_sales
      GROUP BY y, mon, m
      ORDER BY y, mon
    `;

    // Get expenses per month
    const expensesByMonth = await prisma.$queryRaw`
      SELECT
        EXTRACT(YEAR FROM se.created_at)::int AS y,
        EXTRACT(MONTH FROM se.created_at)::int AS mon,
        COALESCE(SUM(se.amount), 0) AS expenses
      FROM store_expenses se
      WHERE se.owner_id = ${owner_id}
        AND se.created_at >= ${fromDate}::date
      GROUP BY y, mon
    `;

    // Create expense lookup map
    const expenseMap = new Map();
    expensesByMonth.forEach(e => {
      const key = `${e.y}-${e.mon}`;
      expenseMap.set(key, Number(e.expenses) || 0);
    });

    return months.map(month => {
      const revenue = Number(month.revenue) || 0;
      const cogs = Number(month.cogs) || 0;
      const key = `${month.y}-${month.mon}`;
      const expenses = expenseMap.get(key) || 0;
      const gross = revenue - cogs;
      const net = gross - expenses;

      return {
        m: month.m,
        revenue,
        cogs,
        expenses,
        gross,
        net,
      };
    });
  }

  /**
   * Get daily trend for selected period
   */
  async _getDailyTrend(owner_id, from, to) {
    const daily = await prisma.$queryRaw`
      SELECT
        d,
        sale_date,
        COALESCE(SUM(net_revenue), 0) AS revenue,
        COALESCE(SUM(cogs), 0) AS cogs
      FROM (
        SELECT
          ss.sales_id,
          TO_CHAR(ss.created_at, 'DD') AS d,
          DATE(ss.created_at) AS sale_date,
          GREATEST(ss.total_amount - COALESCE(ss.discount, 0), 0) AS net_revenue,
          COALESCE(SUM(ssi.cp * ssi.qty), 0) AS cogs
        FROM store_sales ss
        LEFT JOIN store_sales_items ssi ON ssi.sales_id = ss.sales_id
        WHERE ss.owner_id = ${owner_id}
          AND DATE(ss.created_at) >= ${from}::date
          AND DATE(ss.created_at) <= ${to}::date
        GROUP BY ss.sales_id, ss.created_at, ss.total_amount, ss.discount
      ) AS aggregated_sales
      GROUP BY sale_date, d
      ORDER BY sale_date
    `;

    // Get expenses per day
    const expensesByDay = await prisma.$queryRaw`
      SELECT
        DATE(se.created_at) AS expense_date,
        COALESCE(SUM(se.amount), 0) AS expenses
      FROM store_expenses se
      WHERE se.owner_id = ${owner_id}
        AND DATE(se.created_at) >= ${from}::date
        AND DATE(se.created_at) <= ${to}::date
      GROUP BY DATE(se.created_at)
    `;

    // Create expense lookup map
    const expenseMap = new Map();
    expensesByDay.forEach(e => {
      const dateStr = e.expense_date instanceof Date 
        ? e.expense_date.toISOString().split('T')[0]
        : e.expense_date;
      expenseMap.set(dateStr, Number(e.expenses) || 0);
    });

    return daily.map(day => {
      const revenue = Number(day.revenue) || 0;
      const cogs = Number(day.cogs) || 0;
      const dateStr = day.sale_date instanceof Date
        ? day.sale_date.toISOString().split('T')[0]
        : day.sale_date;
      const expenses = expenseMap.get(dateStr) || 0;
      const net = revenue - cogs - expenses;

      return {
        d: day.d,
        revenue,
        cogs,
        net,
      };
    });
  }

  /**
   * Calculate growth percentage
   */
  _calcGrowth(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  /**
   * Calculate days between two dates
   */
  _daysBetween(from, to) {
    const d1 = new Date(from);
    const d2 = new Date(to);
    return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
  }

  /**
   * Subtract days from date
   */
  _subtractDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  }
}

export default new StoreProfitReportService();
