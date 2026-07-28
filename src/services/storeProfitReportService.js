import { prisma } from "../prisma/client.js";
import storeFinancialsService from
  "./storeFinancialsService.js";

function startOfDay(dateLike) {
  const date = new Date(dateLike);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(dateLike) {
  const date = new Date(dateLike);
  date.setHours(23, 59, 59, 999);
  return date;
}

const defaultSections = [
  "summary",
  "top_items",
  "expenses",
  "categories",
  "monthly",
  "daily",
];

class StoreProfitReportService {
  /**
   * Generate the requested profit-report sections only.
   */
  async getReport(
    ownerId,
    {
      from,
      to,
      include = defaultSections,
    },
  ) {
    const sections = new Set(include);

    const rangeStart = startOfDay(from);
    const rangeEnd = endOfDay(to);

    const needsSummary =
      sections.has("summary");

    const needsExpenses =
      sections.has("expenses");

    const needsCurrentFinancials =
      needsSummary || needsExpenses;

    let currentFinancials = null;
    let previousFinancials = null;
    let summary = null;

    /*
     * Current financials are required by:
     * - summary
     * - expense percentage calculation
     */
    if (needsSummary) {
      const periodDifference =
        this._daysBetween(from, to);

      const previousTo =
        this._subtractDays(from, 1);

      const previousFrom =
        this._subtractDays(
          previousTo,
          periodDifference,
        );

      [
        currentFinancials,
        previousFinancials,
      ] = await Promise.all([
        storeFinancialsService
          .getCoreFinancials(
            ownerId,
            rangeStart,
            rangeEnd,
          ),

        storeFinancialsService
          .getCoreFinancials(
            ownerId,
            startOfDay(previousFrom),
            endOfDay(previousTo),
          ),
      ]);

      summary = this._buildSummary(
        currentFinancials,
        previousFinancials,
      );
    } else if (needsExpenses) {
      currentFinancials =
        await storeFinancialsService
          .getCoreFinancials(
            ownerId,
            rangeStart,
            rangeEnd,
          );
    }

    const tasks = [];
    const taskNames = [];

    if (sections.has("top_items")) {
      tasks.push(
        storeFinancialsService
          .getProductBreakdown(
            ownerId,
            rangeStart,
            rangeEnd,
          ),
      );

      taskNames.push("products");
    }

    if (needsExpenses) {
      tasks.push(
        storeFinancialsService
          .getExpenseBreakdown(
            ownerId,
            rangeStart,
            rangeEnd,
            Number(
              currentFinancials
                ?.total_expenses || 0,
            ),
          ),
      );

      taskNames.push("expenses");
    }

    if (sections.has("categories")) {
      tasks.push(
        storeFinancialsService
          .getCategoryBreakdown(
            ownerId,
            rangeStart,
            rangeEnd,
          ),
      );

      taskNames.push("categories");
    }

    if (sections.has("monthly")) {
      tasks.push(
        this._getMonthlyTrend(ownerId),
      );

      taskNames.push("monthly");
    }

    if (sections.has("daily")) {
      tasks.push(
        storeFinancialsService
          .getDailyTrend(
            ownerId,
            rangeStart,
            rangeEnd,
          ),
      );

      taskNames.push("daily");
    }

    /*
     * Independent database operations execute
     * concurrently.
     */
    const taskResults =
      await Promise.all(tasks);

    const resolved = {};

    taskNames.forEach((name, index) => {
      resolved[name] = taskResults[index];
    });

    const response = {};

    if (needsSummary) {
      response.summary = summary;
    }

    /*
     * Flutter currently reads expenses from:
     * summary['expense_breakdown']
     */
    if (needsExpenses) {
      if (!summary) {
        summary = {
          total_expenses: Number(
            currentFinancials
              ?.total_expenses || 0,
          ),
        };
      }

      summary.expense_breakdown =
        resolved.expenses ?? [];

      response.summary = summary;
    }

    if (sections.has("top_items")) {
      response.top_profitable_items =
        this._formatTopItems(
          resolved.products ?? [],
        );
    }

    if (sections.has("categories")) {
      response.profit_by_category =
        this._formatCategories(
          resolved.categories ?? [],
        );
    }

    if (sections.has("monthly")) {
      response.monthly =
        resolved.monthly ?? [];
    }

    if (sections.has("daily")) {
      response.daily =
        this._formatDailyTrend(
          resolved.daily ?? [],
        );
    }

    return response;
  }

  /**
   * Creates UI-compatible summary keys while preserving
   * the shared financial-service fields.
   *
   * Required formulas:
   *
   * Actual Revenue =
   * total amount - discount - refunds
   *
   * Net Cost =
   * sold cost - returned cost
   *
   * Gross Profit =
   * actual revenue - net cost
   *
   * Net Profit =
   * gross profit - expenses
   */
  _buildSummary(current, previous) {
    const actualRevenue = Number(
      current?.actual_revenue || 0,
    );

    const netCost = Number(
      current?.net_cost || 0,
    );

    const grossProfit = Number(
      current?.gross_profit || 0,
    );

    const netProfit = Number(
      current?.net_profit || 0,
    );

    const totalExpenses = Number(
      current?.total_expenses || 0,
    );

    const totalRefund = Number(
      current?.total_refund || 0,
    );

    const previousRevenue = Number(
      previous?.actual_revenue || 0,
    );

    const previousProfit = Number(
      previous?.net_profit || 0,
    );

    const previousExpenses = Number(
      previous?.total_expenses || 0,
    );

    const netMargin =
      actualRevenue > 0
        ? (netProfit / actualRevenue) * 100
        : 0;

    const previousMargin =
      previousRevenue > 0
        ? (
            previousProfit /
            previousRevenue
          ) * 100
        : 0;

    return {
      ...current,

      /*
       * Aliases expected by the existing Flutter screen.
       */
      net_revenue: Number(
        actualRevenue.toFixed(2),
      ),

      cogs: Number(
        netCost.toFixed(2),
      ),

      refunds: Number(
        totalRefund.toFixed(2),
      ),

      gross_margin: Number(
        (
          actualRevenue > 0
            ? (
                grossProfit /
                actualRevenue
              ) * 100
            : 0
        ).toFixed(2),
      ),

      net_margin: Number(
        netMargin.toFixed(2),
      ),

      expense_ratio: Number(
        (
          actualRevenue > 0
            ? (
                totalExpenses /
                actualRevenue
              ) * 100
            : 0
        ).toFixed(2),
      ),

      cogs_ratio: Number(
        (
          actualRevenue > 0
            ? (
                netCost /
                actualRevenue
              ) * 100
            : 0
        ).toFixed(2),
      ),

      revenue_growth: Number(
        this._calcGrowth(
          actualRevenue,
          previousRevenue,
        ).toFixed(2),
      ),

      profit_growth: Number(
        this._calcGrowth(
          netProfit,
          previousProfit,
        ).toFixed(2),
      ),

      expense_growth: Number(
        this._calcGrowth(
          totalExpenses,
          previousExpenses,
        ).toFixed(2),
      ),

      margin_change: Number(
        (
          netMargin -
          previousMargin
        ).toFixed(2),
      ),
    };
  }

  _formatTopItems(products) {
    return products
      .filter(
        (product) =>
          Number(product.profit || 0) > 0,
      )
      .sort(
        (a, b) =>
          Number(b.profit || 0) -
          Number(a.profit || 0),
      )
      .slice(0, 5)
      .map((product) => {
        const revenue = Number(
          product.revenue || 0,
        );

        const cogs = Number(
          product.cogs || 0,
        );

        const profit = Number(
          product.profit || 0,
        );

        const margin =
          product.margin != null
            ? Number(product.margin)
            : revenue > 0
            ? (profit / revenue) * 100
            : 0;

        return {
          name:
            product.product_name ??
            product.name ??
            "Unknown item",

          revenue: Number(
            revenue.toFixed(2),
          ),

          cogs: Number(
            cogs.toFixed(2),
          ),

          profit: Number(
            profit.toFixed(2),
          ),

          margin: Number(
            margin.toFixed(1),
          ),

          qty: Number(
            product.qty ||
            product.qty_sold ||
            0,
          ),
        };
      });
  }

  _formatCategories(categories) {
    return categories
      .filter(
        (category) =>
          Number(category.profit || 0) > 0,
      )
      .sort(
        (a, b) =>
          Number(b.profit || 0) -
          Number(a.profit || 0),
      )
      .map((category) => {
        const revenue = Number(
          category.revenue || 0,
        );

        const profit = Number(
          category.profit || 0,
        );

        const margin =
          category.margin != null
            ? Number(category.margin)
            : revenue > 0
            ? (profit / revenue) * 100
            : 0;

        return {
          name:
            category.category_name ??
            category.name ??
            "Uncategorized",

          revenue: Number(
            revenue.toFixed(2),
          ),

          profit: Number(
            profit.toFixed(2),
          ),

          margin: Number(
            margin.toFixed(1),
          ),
        };
      });
  }

  _formatDailyTrend(rows) {
    return rows.map((row) => {
      const revenue = Number(
        row.revenue || 0,
      );

      const cogs = Number(
        row.cogs ||
        row.net_cost ||
        0,
      );

      const net =
        row.net_profit != null
          ? Number(row.net_profit)
          : row.net != null
          ? Number(row.net)
          : revenue - cogs;

      const rawDate =
        row.date?.toString() ??
        row.sale_date?.toString() ??
        "";

      let dayLabel =
        row.d?.toString() ?? "";

      if (
        dayLabel.isEmpty &&
        rawDate.length >= 10
      ) {
        dayLabel = rawDate.slice(8, 10);
      }

      return {
        d: dayLabel,
        revenue: Number(
          revenue.toFixed(2),
        ),
        cogs: Number(
          cogs.toFixed(2),
        ),
        net: Number(
          net.toFixed(2),
        ),
      };
    });
  }

  /**
   * Returns the last six months of profit data.
   *
   * This is only executed when the monthly section
   * is requested.
   */
  async _getMonthlyTrend(ownerId) {
    const sixMonthsAgo = new Date();

    sixMonthsAgo.setMonth(
      sixMonthsAgo.getMonth() - 6,
    );

    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const fromDate =
      sixMonthsAgo
        .toISOString()
        .split("T")[0];

    const months = await prisma.$queryRaw`
      SELECT
        month_label,
        year_number,
        month_number,
        COALESCE(SUM(revenue), 0) AS revenue,
        COALESCE(SUM(cogs), 0) AS cogs
      FROM (
        SELECT
          ss.sales_id,

          TO_CHAR(
            ss.created_at,
            'Mon'
          ) AS month_label,

          EXTRACT(
            YEAR FROM ss.created_at
          )::int AS year_number,

          EXTRACT(
            MONTH FROM ss.created_at
          )::int AS month_number,

          GREATEST(
            ss.total_amount -
            COALESCE(ss.discount, 0),
            0
          ) AS revenue,

          COALESCE(
            SUM(ssi.cp * ssi.qty),
            0
          ) AS cogs

        FROM store_sales ss

        LEFT JOIN store_sales_items ssi
          ON ssi.sales_id = ss.sales_id

        WHERE ss.owner_id = ${ownerId}
          AND ss.created_at >= ${fromDate}::date

        GROUP BY
          ss.sales_id,
          ss.created_at,
          ss.total_amount,
          ss.discount
      ) AS aggregated_sales

      GROUP BY
        year_number,
        month_number,
        month_label

      ORDER BY
        year_number,
        month_number
    `;

    const expensesByMonth =
      await prisma.$queryRaw`
        SELECT
          EXTRACT(
            YEAR FROM se.created_at
          )::int AS year_number,

          EXTRACT(
            MONTH FROM se.created_at
          )::int AS month_number,

          COALESCE(
            SUM(se.amount),
            0
          ) AS expenses

        FROM store_expenses se

        WHERE se.owner_id = ${ownerId}
          AND se.created_at >= ${fromDate}::date

        GROUP BY
          year_number,
          month_number
      `;

    const expenseMap = new Map();

    for (const expense of expensesByMonth) {
      const key =
        `${expense.year_number}-` +
        `${expense.month_number}`;

      expenseMap.set(
        key,
        Number(expense.expenses) || 0,
      );
    }

    return months.map((month) => {
      const revenue = Number(
        month.revenue || 0,
      );

      const cogs = Number(
        month.cogs || 0,
      );

      const key =
        `${month.year_number}-` +
        `${month.month_number}`;

      const expenses =
        expenseMap.get(key) || 0;

      const gross = revenue - cogs;
      const net = gross - expenses;

      return {
        m: month.month_label,
        revenue: Number(
          revenue.toFixed(2),
        ),
        cogs: Number(
          cogs.toFixed(2),
        ),
        expenses: Number(
          expenses.toFixed(2),
        ),
        gross: Number(
          gross.toFixed(2),
        ),
        net: Number(
          net.toFixed(2),
        ),
      };
    });
  }

  _calcGrowth(current, previous) {
    const currentValue =
      Number(current || 0);

    const previousValue =
      Number(previous || 0);

    if (previousValue === 0) {
      return currentValue > 0 ? 100 : 0;
    }

    return (
      (
        currentValue -
        previousValue
      ) /
      Math.abs(previousValue)
    ) * 100;
  }

  _daysBetween(from, to) {
    const firstDate =
      new Date(`${from}T00:00:00`);

    const secondDate =
      new Date(`${to}T00:00:00`);

    const millisecondsPerDay =
      1000 * 60 * 60 * 24;

    return Math.round(
      (
        secondDate -
        firstDate
      ) /
      millisecondsPerDay,
    );
  }

  _subtractDays(dateString, days) {
    const date =
      new Date(`${dateString}T00:00:00`);

    date.setDate(
      date.getDate() - days,
    );

    const year =
      date.getFullYear();

    const month = String(
      date.getMonth() + 1,
    ).padStart(2, "0");

    const day = String(
      date.getDate(),
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }
}

export default new StoreProfitReportService();