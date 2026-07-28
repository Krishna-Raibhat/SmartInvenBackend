// src/services/storeSaleDaybookService.js
import { prisma } from "../prisma/client.js";
import storeFinancialsService from "./storeFinancialsService.js";

const num = (v) => (v === null || v === undefined ? 0 : Number(v));

// Earliest possible created_at — used as the lower bound when summing
// "everything before today" for the opening balance.
const EPOCH = new Date(0);

class StoreSaleDaybookService {
  /**
   * Build the day's sales daybook for a store owner: customer-side
   * activity only, each with a net-revenue impact (credit or debit) —
   *   - Stock Out  → StoreSales            (credit, net of discount)
   *   - Return     → StoreCustomerReturn   (debit, refund paid to customer)
   *   - Expense    → StoreExpense          (debit, money spent)
   *
   * Net revenue is computed via storeFinancialsService.getCoreFinancials —
   * the same single source of truth used by the Store Reports screen
   * (net of discount, customer refunds, expenses), so the daybook's
   * numbers always agree with the reports.
   *
   * The daybook itself is a single day's history, but the balance carries
   * over from previous days:
   *   opening_balance = net revenue accumulated from all activity BEFORE this day
   *   closing_balance  = opening_balance + today's credits - today's debits
   * so tomorrow's opening_balance is simply today's closing_balance.
   *
   * @param {string} owner_id
   * @param {string|undefined} dateStr - optional "YYYY-MM-DD", defaults to today (server local time)
   */
  async getDaybook(owner_id, dateStr) {
    const { start, end, label } = this._resolveDayRange(dateStr);
    const range = { gte: start, lte: end };

    const [sales, customerReturns, expenses, todayFinancials, historyFinancials] =
      await Promise.all([
        // Stock Out (sale)
        prisma.storeSales.findMany({
          where: { owner_id, created_at: range },
          select: {
            sales_id: true,
            total_amount: true,
            discount: true,
            payment_status: true,
            created_at: true,
            customer: { select: { full_name: true, phone: true } },
            items: { select: { sales_item_id: true } },
          },
          orderBy: { created_at: "asc" },
        }),

        // Return (customer return / refund paid out)
        prisma.storeCustomerReturn.findMany({
          where: { owner_id, created_at: range },
          select: {
            return_id: true,
            refund_amount: true,
            note: true,
            created_at: true,
            sales: {
              select: {
                sales_id: true,
                customer: { select: { full_name: true } },
              },
            },
          },
          orderBy: { created_at: "asc" },
        }),

        // Expense (money spent)
        prisma.storeExpense.findMany({
          where: { owner_id, created_at: range },
          select: {
            expense_id: true,
            amount: true,
            note: true,
            created_at: true,
            title: { select: { title: true } },
          },
          orderBy: { created_at: "asc" },
        }),

        // Same net-revenue math the Store Reports screen uses, for today
        storeFinancialsService.getCoreFinancials(owner_id, start, end),

        // ...and for everything before today, to derive the opening balance
        storeFinancialsService.getCoreFinancials(owner_id, EPOCH, new Date(start.getTime() - 1)),
      ]);

    const entries = [];

    for (const s of sales) {
      const customerLabel = s.customer?.full_name || s.customer?.phone || "Walk-in Customer";
      const netAmount = Math.max(0, num(s.total_amount) - num(s.discount));
      entries.push({
        entry_id: s.sales_id,
        type: "STOCK_OUT",
        title: `Stock Out · ${s.sales_id.slice(0, 8).toUpperCase()}`,
        reference: `${customerLabel} · ${s.items.length} item${s.items.length === 1 ? "" : "s"}`,
        time: s.created_at,
        flow: "credit",
        amount: netAmount,
        meta: {
          payment_status: s.payment_status,
          gross_amount: num(s.total_amount),
          discount: num(s.discount),
        },
      });
    }

    for (const r of customerReturns) {
      const customerLabel = r.sales?.customer?.full_name || "Customer";
      entries.push({
        entry_id: r.return_id,
        type: "RETURN",
        title: `Return · ${r.sales?.sales_id?.slice(0, 8).toUpperCase() || ""}`,
        reference: r.note || `${customerLabel} · items returned`,
        time: r.created_at,
        flow: "debit",
        amount: num(r.refund_amount),
      });
    }

    for (const e of expenses) {
      entries.push({
        entry_id: e.expense_id,
        type: "EXPENSE",
        title: `Expense · ${e.title?.title || "General"}`,
        reference: e.note || "Store expense",
        time: e.created_at,
        flow: "debit",
        amount: num(e.amount),
      });
    }

    entries.sort((a, b) => new Date(a.time) - new Date(b.time));

    // Credit/debit totals derived from the same figures storeFinancialsService
    // computes for the reports screen (net_revenue is already total_amount -
    // discount, GREATEST-floored at 0).
    const total_credit = todayFinancials.net_revenue;
    const total_debit = todayFinancials.total_refund + todayFinancials.total_expenses;

    const opening_balance =
      historyFinancials.net_revenue -
      historyFinancials.total_refund -
      historyFinancials.total_expenses;
    const closing_balance = opening_balance + total_credit - total_debit;

    // Running balance per entry, computed against this day's opening balance
    let running = opening_balance;
    for (const e of entries) {
      if (e.flow === "credit") running += e.amount;
      if (e.flow === "debit") running -= e.amount;
      e.balance = running;
    }

    return {
      date: label,
      opening_balance,
      closing_balance,
      total_credit,
      total_debit,
      entries,
    };
  }

  /**
   * Resolves a "YYYY-MM-DD" date string (or defaults to today) into a
   * start/end-of-day range in server local time.
   */
  _resolveDayRange(dateStr) {
    let base;
    if (dateStr) {
      const parsed = new Date(`${dateStr}T00:00:00`);
      if (isNaN(parsed.getTime())) {
        const e = new Error("Invalid date format. Use YYYY-MM-DD.");
        e.status = 400;
        e.code = "VALIDATION_DATE_INVALID";
        throw e;
      }
      base = parsed;
    } else {
      base = new Date();
    }

    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
    const end = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59, 999);
    const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(
      start.getDate()
    ).padStart(2, "0")}`;

    return { start, end, label };
  }
}

export default new StoreSaleDaybookService();