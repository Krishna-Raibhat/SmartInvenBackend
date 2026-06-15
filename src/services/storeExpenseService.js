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
    const rows = await prisma.storeExpenseTitle.findMany({
      where: { owner_id },
      orderBy: { title: "asc" },
      include: {
        _count: { select: { expenses: true } },
        expenses: { select: { amount: true } },
      },
    });

    return rows.map(({ _count, expenses, ...t }) => ({
      ...t,
      expense_count: _count.expenses,
      total_amount: expenses.reduce((s, e) => s + Number(e.amount), 0),
    }));
  }

  async getById(owner_id, title_id) {
    const title = await prisma.storeExpenseTitle.findFirst({
      where: { title_id, owner_id },
      include: {
        _count: { select: { expenses: true } },
        expenses: { select: { amount: true } },
      },
    });
    if (!title) {
      const e = new Error("Title not found.");
      e.status = 404; e.code = "NOT_FOUND"; throw e;
    }
    const { _count, expenses, ...rest } = title;
    return {
      ...rest,
      expense_count: _count.expenses,
      total_amount: expenses.reduce((s, e) => s + Number(e.amount), 0),
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
    });
    if (!title) {
      const e = new Error("Expense title not found.");
      e.status = 404; e.code = "NOT_FOUND"; throw e;
    }
    const skip = (page - 1) * limit;
    const where = { owner_id, title_id };

    const [data, total, agg] = await Promise.all([
      prisma.storeExpense.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
        include: { title: true },
      }),
      prisma.storeExpense.count({ where }),
      prisma.storeExpense.aggregate({ where, _sum: { amount: true } }),
    ]);

    return {
      title,
      total_amount: Number(agg._sum.amount ?? 0),
      data,
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
    const where = { owner_id };
    if (start || end) {
      where.created_at = {};
      if (start) where.created_at.gte = new Date(start);
      if (end) where.created_at.lte = new Date(end);
    }
    const rows = await prisma.storeExpense.groupBy({
      by: ["title_id"],
      where,
      _sum: { amount: true },
      _count: { expense_id: true },
    });
    const titleIds = rows.map((r) => r.title_id);
    const titles = await prisma.storeExpenseTitle.findMany({
      where: { title_id: { in: titleIds } },
      select: { title_id: true, title: true },
    });
    const titleMap = Object.fromEntries(titles.map((t) => [t.title_id, t.title]));

    return rows
      .map((r) => ({
        title_id: r.title_id,
        title: titleMap[r.title_id] ?? "Unknown",
        total_amount: Number(r._sum.amount ?? 0),
        count: r._count.expense_id,
      }))
      .sort((a, b) => b.total_amount - a.total_amount);
  }
}

export const expenseTitleService = new StoreExpenseTitleService();
export const expenseService = new StoreExpenseService();