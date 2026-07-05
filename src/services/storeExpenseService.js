// src/services/storeExpenseService.js
import { prisma } from "../prisma/client.js";
import { Prisma } from "@prisma/client";

const Decimal = Prisma.Decimal;

// ─────────────────────────────────────────────
// EXPENSE TITLE SERVICE
// ─────────────────────────────────────────────
class StoreExpenseTitleService {
  async create(owner_id, { title }) {
    if (!title || String(title).trim() === "") {
      const e = new Error("title is required.");
      e.status = 400; e.code = "REQUIRED_FIELDS"; throw e;
    }
    try {
      return await prisma.storeExpenseTitle.create({
        data: { owner_id, title: String(title).trim() },
      });
    } catch (err) {
      if (err.code === "P2002") {
        const e = new Error("Title already exists.");
        e.status = 409; e.code = "DUPLICATE"; throw e;
      }
      throw err;
    }
  }

  async list(owner_id) {
    const rows = await prisma.$queryRaw`
      SELECT 
        t.title_id,
        t.owner_id,
        t.title,
        t.created_at,
        t.updated_at,
        COUNT(e.expense_id)::int AS expense_count,
        COALESCE(SUM(e.amount), 0)::numeric AS total_amount
      FROM store_expense_titles t
      LEFT JOIN store_expenses e ON t.title_id = e.title_id
      WHERE t.owner_id = ${owner_id}
      GROUP BY t.title_id, t.owner_id, t.title, t.created_at, t.updated_at
      ORDER BY t.title ASC
    `;

    return rows.map((r) => ({
      title_id: r.title_id,
      owner_id: r.owner_id,
      title: r.title,
      created_at: r.created_at,
      updated_at: r.updated_at,
      expense_count: r.expense_count,
      total_amount: Number(r.total_amount),
    }));
  }

  async getById(owner_id, title_id) {
    const rows = await prisma.$queryRaw`
      SELECT 
        t.title_id,
        t.owner_id,
        t.title,
        t.created_at,
        t.updated_at,
        COUNT(e.expense_id)::int AS expense_count,
        COALESCE(SUM(e.amount), 0)::numeric AS total_amount
      FROM store_expense_titles t
      LEFT JOIN store_expenses e ON t.title_id = e.title_id
      WHERE t.owner_id = ${owner_id} AND t.title_id = ${title_id}
      GROUP BY t.title_id, t.owner_id, t.title, t.created_at, t.updated_at
    `;

    const title = rows[0];
    if (!title) {
      const e = new Error("Title not found.");
      e.status = 404; e.code = "NOT_FOUND"; throw e;
    }

    return {
      title_id: title.title_id,
      owner_id: title.owner_id,
      title: title.title,
      created_at: title.created_at,
      updated_at: title.updated_at,
      expense_count: title.expense_count,
      total_amount: Number(title.total_amount),
    };
  }

  async update(owner_id, title_id, { title }) {
    const existing = await prisma.storeExpenseTitle.findFirst({
      where: { title_id, owner_id },
    });
    if (!existing) {
      const e = new Error("Title not found.");
      e.status = 404; e.code = "NOT_FOUND"; throw e;
    }
    if (!title || String(title).trim() === "") {
      const e = new Error("title cannot be empty.");
      e.status = 400; e.code = "VALIDATION_ERROR"; throw e;
    }
    try {
      return await prisma.storeExpenseTitle.update({
        where: { title_id },
        data: { title: String(title).trim() },
      });
    } catch (err) {
      if (err.code === "P2002") {
        const e = new Error("Title already exists.");
        e.status = 409; e.code = "DUPLICATE"; throw e;
      }
      throw err;
    }
  }

  async delete(owner_id, title_id) {
    const existing = await prisma.storeExpenseTitle.findFirst({
      where: { title_id, owner_id },
      include: { _count: { select: { expenses: true } } },
    });
    if (!existing) {
      const e = new Error("Title not found.");
      e.status = 404; e.code = "NOT_FOUND"; throw e;
    }
    if (existing._count.expenses > 0) {
      const e = new Error(`Cannot delete title. It has ${existing._count.expenses} expense(s) linked.`);
      e.status = 409; e.code = "IN_USE";
      e.details = { expense_count: existing._count.expenses };
      throw e;
    }
    await prisma.storeExpenseTitle.delete({ where: { title_id } });
    return { message: "Title deleted successfully." };
  }
}

// ─────────────────────────────────────────────
// EXPENSE SERVICE
// ─────────────────────────────────────────────
class StoreExpenseService {
  async create(owner_id, { title_id, amount, note }) {
    if (!title_id) {
      const e = new Error("title_id is required.");
      e.status = 400; e.code = "REQUIRED_FIELDS"; throw e;
    }
    const amt = Number(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      const e = new Error("amount must be greater than 0.");
      e.status = 400; e.code = "REQUIRED_FIELDS"; throw e;
    }
    const title = await prisma.storeExpenseTitle.findFirst({
      where: { title_id, owner_id },
    });
    if (!title) {
      const e = new Error("Expense title not found.");
      e.status = 404; e.code = "NOT_FOUND"; throw e;
    }
    return prisma.storeExpense.create({
      data: {
        owner_id,
        title_id,
        amount: new Decimal(amt),
        note: note ? String(note).trim() : null,
      },
      include: { title: true },
    });
  }

  async list(owner_id, { page = 1, limit = 50, title_id } = {}) {
    const skip = (page - 1) * limit;
    const where = { owner_id, ...(title_id ? { title_id } : {}) };

    const [data, total] = await Promise.all([
      prisma.storeExpense.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
        include: { title: true },
      }),
      prisma.storeExpense.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(owner_id, expense_id) {
    const expense = await prisma.storeExpense.findFirst({
      where: { expense_id, owner_id },
      include: { title: true },
    });
    if (!expense) {
      const e = new Error("Expense not found.");
      e.status = 404; e.code = "NOT_FOUND"; throw e;
    }
    return expense;
  }

  async getByTitle(owner_id, title_id, { page = 1, limit = 50 } = {}) {
    const title = await prisma.storeExpenseTitle.findFirst({
      where: { title_id, owner_id },
      include: {
        _count: { select: { expenses: true } },
      },
    });
    if (!title) {
      const e = new Error("Expense title not found.");
      e.status = 404; e.code = "NOT_FOUND"; throw e;
    }

    const total = title._count.expenses;
    const skip = (page - 1) * limit;
    const where = { owner_id, title_id };

    const [data, agg] = await Promise.all([
      prisma.storeExpense.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
      }),
      prisma.storeExpense.aggregate({ where, _sum: { amount: true } }),
    ]);

    const { _count, ...titleWithoutCount } = title;
    const dataWithTitle = data.map((item) => ({
      ...item,
      title: titleWithoutCount,
    }));

    return {
      title: titleWithoutCount,
      total_amount: Number(agg._sum.amount ?? 0),
      data: dataWithTitle,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async update(owner_id, expense_id, { title_id, amount, note }) {
    const existing = await prisma.storeExpense.findFirst({
      where: { expense_id, owner_id },
    });
    if (!existing) {
      const e = new Error("Expense not found.");
      e.status = 404; e.code = "NOT_FOUND"; throw e;
    }
    const data = {};
    if (title_id !== undefined) {
      const title = await prisma.storeExpenseTitle.findFirst({
        where: { title_id, owner_id },
      });
      if (!title) {
        const e = new Error("Expense title not found.");
        e.status = 404; e.code = "NOT_FOUND"; throw e;
      }
      data.title_id = title_id;
    }
    if (amount !== undefined) {
      const amt = Number(amount);
      if (isNaN(amt) || amt <= 0) {
        const e = new Error("amount must be greater than 0.");
        e.status = 400; e.code = "VALIDATION_ERROR"; throw e;
      }
      data.amount = new Decimal(amt);
    }
    if (note !== undefined) data.note = note ? String(note).trim() : null;

    return prisma.storeExpense.update({
      where: { expense_id },
      data,
      include: { title: true },
    });
  }

  async delete(owner_id, expense_id) {
    const existing = await prisma.storeExpense.findFirst({
      where: { expense_id, owner_id },
    });
    if (!existing) {
      const e = new Error("Expense not found.");
      e.status = 404; e.code = "NOT_FOUND"; throw e;
    }
    await prisma.storeExpense.delete({ where: { expense_id } });
    return { message: "Expense deleted successfully." };
  }

  async getTotalExpenses(owner_id, { start, end } = {}) {
    const where = { owner_id };
    if (start || end) {
      where.created_at = {};
      if (start) where.created_at.gte = new Date(start);
      if (end) where.created_at.lte = new Date(end);
    }
    const agg = await prisma.storeExpense.aggregate({
      where,
      _sum: { amount: true },
    });
    return Number(agg._sum.amount ?? 0);
  }

  async summaryByTitle(owner_id, { start, end } = {}) {
    let query;
    if (start || end) {
      const startFinal = start ? new Date(start) : null;
      const endFinal = end ? new Date(end) : null;
      if (startFinal && endFinal) {
        query = prisma.$queryRaw`
          SELECT 
            e.title_id,
            t.title,
            COALESCE(SUM(e.amount), 0)::numeric AS total_amount,
            COUNT(e.expense_id)::int AS count
          FROM store_expenses e
          JOIN store_expense_titles t ON e.title_id = t.title_id
          WHERE e.owner_id = ${owner_id}
            AND e.created_at >= ${startFinal}
            AND e.created_at <= ${endFinal}
          GROUP BY e.title_id, t.title
          ORDER BY total_amount DESC
        `;
      } else if (startFinal) {
        query = prisma.$queryRaw`
          SELECT 
            e.title_id,
            t.title,
            COALESCE(SUM(e.amount), 0)::numeric AS total_amount,
            COUNT(e.expense_id)::int AS count
          FROM store_expenses e
          JOIN store_expense_titles t ON e.title_id = t.title_id
          WHERE e.owner_id = ${owner_id}
            AND e.created_at >= ${startFinal}
          GROUP BY e.title_id, t.title
          ORDER BY total_amount DESC
        `;
      } else {
        query = prisma.$queryRaw`
          SELECT 
            e.title_id,
            t.title,
            COALESCE(SUM(e.amount), 0)::numeric AS total_amount,
            COUNT(e.expense_id)::int AS count
          FROM store_expenses e
          JOIN store_expense_titles t ON e.title_id = t.title_id
          WHERE e.owner_id = ${owner_id}
            AND e.created_at <= ${endFinal}
          GROUP BY e.title_id, t.title
          ORDER BY total_amount DESC
        `;
      }
    } else {
      query = prisma.$queryRaw`
        SELECT 
          e.title_id,
          t.title,
          COALESCE(SUM(e.amount), 0)::numeric AS total_amount,
          COUNT(e.expense_id)::int AS count
        FROM store_expenses e
        JOIN store_expense_titles t ON e.title_id = t.title_id
        WHERE e.owner_id = ${owner_id}
        GROUP BY e.title_id, t.title
        ORDER BY total_amount DESC
      `;
    }

    const rows = await query;
    return rows.map((r) => ({
      title_id: r.title_id,
      title: r.title,
      total_amount: Number(r.total_amount),
      count: Number(r.count),
    }));
  }

    async getReport(owner_id, { start, end, group = "day" } = {}) {
        const now = new Date();
        const endFinal = end ? new Date(end) : now;
        endFinal.setHours(23, 59, 59, 999);

        const startFinal = start
            ? new Date(start)
            : new Date(now.getFullYear(), now.getMonth(), 1); // default: this month
        startFinal.setHours(0, 0, 0, 0);

        // Previous period (same duration)
        const duration = endFinal - startFinal;
        const prevEnd = new Date(startFinal.getTime() - 1);
        const prevStart = new Date(startFinal.getTime() - duration - 1);

        const rows = await prisma.$queryRaw`
          WITH summary AS (
            SELECT
              COALESCE(SUM(e.amount), 0)::numeric          AS total_expenses,
              COUNT(e.expense_id)::int                     AS total_transactions,
              COUNT(DISTINCT e.title_id)::int              AS category_count
            FROM store_expenses e
            WHERE e.owner_id = ${owner_id}
              AND e.created_at >= ${startFinal}
              AND e.created_at <= ${endFinal}
          ),
          prev_summary AS (
            SELECT COALESCE(SUM(amount), 0)::numeric AS total_expenses
            FROM store_expenses
            WHERE owner_id = ${owner_id}
              AND created_at >= ${prevStart}
              AND created_at <= ${prevEnd}
          ),
          categories AS (
            SELECT
              t.title_id,
              t.title,
              COALESCE(SUM(e.amount), 0)::numeric   AS total_amount,
              COUNT(e.expense_id)::int              AS entry_count
            FROM store_expense_titles t
            LEFT JOIN store_expenses e
              ON e.title_id = t.title_id
              AND e.owner_id = ${owner_id}
              AND e.created_at >= ${startFinal}
              AND e.created_at <= ${endFinal}
            WHERE t.owner_id = ${owner_id}
            GROUP BY t.title_id, t.title
            HAVING COALESCE(SUM(e.amount), 0) > 0
            ORDER BY total_amount DESC
          ),
          daily AS (
            SELECT
              DATE(e.created_at) AS date_only,
              t.title,
              SUM(e.amount)::numeric AS amount
            FROM store_expenses e
            JOIN store_expense_titles t ON t.title_id = e.title_id
            WHERE e.owner_id = ${owner_id}
                AND e.created_at >= ${startFinal}
                AND e.created_at <= ${endFinal}
            GROUP BY DATE(e.created_at), t.title
            ORDER BY DATE(e.created_at) ASC
          )
          SELECT
            (SELECT json_build_object('total_expenses', total_expenses, 'total_transactions', total_transactions, 'category_count', category_count) FROM summary) AS summary,
            COALESCE((SELECT total_expenses FROM prev_summary), 0)::numeric AS prev_total_expenses,
            COALESCE((SELECT json_agg(json_build_object('title_id', title_id, 'title', title, 'total_amount', total_amount, 'entry_count', entry_count)) FROM categories), '[]'::json) AS categories,
            COALESCE((SELECT json_agg(json_build_object('date_only', date_only, 'title', title, 'amount', amount)) FROM daily), '[]'::json) AS daily
        `;

        const row = rows[0] || {};
        const s = row.summary || {};
        const totalExpenses     = Number(s.total_expenses     || 0);
        const totalTransactions = Number(s.total_transactions || 0);
        const categoryCount     = Number(s.category_count     || 0);
        const prevTotal         = Number(row.prev_total_expenses || 0);
        const categoryRows      = row.categories || [];
        const dailyExpenses     = row.daily || [];

        // % change vs last period
        const vsLastPeriod = prevTotal === 0
            ? null
            : Number((((totalExpenses - prevTotal) / prevTotal) * 100).toFixed(1));

        // Category breakdown with percentage
        const categories = categoryRows.map((r) => ({
            title_id:    r.title_id,
            title:       r.title,
            total_amount: Number(r.total_amount),
            entry_count:  Number(r.entry_count),
            percentage:   totalExpenses > 0
            ? Number(((Number(r.total_amount) / totalExpenses) * 100).toFixed(1))
            : 0,
        }));

        const largestCategory = categories[0] ?? null;
        const smallestCategory = categories.length > 0 ? categories[categories.length - 1] : null;

        // Populate continuous daily entries
        const trendMap = new Map();
        const curr = new Date(startFinal);
        while (curr <= endFinal) {
          const dateStr = curr.toISOString().split('T')[0];
          const dayStr = String(curr.getDate()).padStart(2, '0');
          trendMap.set(dateStr, {
            date: dayStr,
            total: 0,
            top: 'N/A',
            maxAmount: 0
          });
          curr.setDate(curr.getDate() + 1);
        }

        for (const row of dailyExpenses) {
          const dateStr = row.date_only instanceof Date
            ? row.date_only.toISOString().split('T')[0]
            : new Date(row.date_only).toISOString().split('T')[0];
          const amt = Number(row.amount);
          const title = row.title;

          if (trendMap.has(dateStr)) {
            const entry = trendMap.get(dateStr);
            entry.total += amt;
            if (amt > entry.maxAmount) {
              entry.maxAmount = amt;
              entry.top = title;
            }
          }
        }

        const trend = Array.from(trendMap.values()).map(e => ({
          date: e.date,
          total: e.total,
          top: e.top === 'N/A' ? 'None' : e.top
        }));

        let highestDayAmount = 0;
        let highestDayDate = 'None';
        for (const [dateStr, entry] of trendMap.entries()) {
          if (entry.total > highestDayAmount) {
            highestDayAmount = entry.total;
            highestDayDate = dateStr;
          }
        }
        if (highestDayDate !== 'None') {
          const d = new Date(highestDayDate);
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          highestDayDate = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
        }

        const daysCount = Math.max(1, Math.round((endFinal - startFinal) / (1000 * 60 * 60 * 24)) + 1);
        const avgDailyExpense = Number((totalExpenses / daysCount).toFixed(2));

        return {
            date_range: {
              start: startFinal.toISOString(),
              end:   endFinal.toISOString(),
            },
            summary: {
              total_expenses:     totalExpenses,
              total_transactions: totalTransactions,
              category_count:     categoryCount,
              vs_last_period:     vsLastPeriod,
              avg_daily_expense:  avgDailyExpense,
              highest_day_amount: highestDayAmount,
              highest_day_date:   highestDayDate,
              largest_category:   largestCategory
                ? { title: largestCategory.title, amount: largestCategory.total_amount, percentage: largestCategory.percentage }
                : null,
              smallest_category:  smallestCategory
                ? { title: smallestCategory.title, amount: smallestCategory.total_amount, percentage: smallestCategory.percentage }
                : null,
            },
            categories,
            trend,
        };
    }

}

export const expenseTitleService = new StoreExpenseTitleService();
export const expenseService = new StoreExpenseService();