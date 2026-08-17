// src/services/storeSaleDaybookService.js
import { prisma } from "../prisma/client.js";
import {
  parseNPTDateStart,
  parseNPTDateEnd,
  todayStartUTC,
  NPT_OFFSET_MS,
} from "../utils/nptTime.js";

const num = (v) => (v === null || v === undefined ? 0 : Number(v));

class StoreSaleDaybookService {
  /**
   * Cash-based Daily Salesbook (Daybook):
   *   - Sale entries    → amount actually paid AT SALE TIME (initial_paid_amount)
   *   - Credit Received → old dues collected TODAY (store_due_payments)
   *   - Expense / Return → outflow
   * "Credit" = today's still-unpaid portion of today's sales (not part of inflow).
   * closing_balance = today's inflow - today's outflow.
   */
  async getDaybook(owner_id, dateStr) {
    const { start, end, label } = this._resolveDayRange(dateStr);

    // Today's sales/payments/expenses/returns, fetched in ONE round trip
    // via json_agg subqueries, instead of 4 separate queries.
    const [row] = await prisma.$queryRaw`
      SELECT
        (SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json) FROM (
          SELECT
            ss.sales_id,
            ss.total_amount,
            ss.discount,
            ss.initial_paid_amount,
            ss.payment_method,
            ss.payment_status,
            ss.created_at,
            c.full_name AS customer_name,
            c.phone AS customer_phone,
            (SELECT COUNT(*) FROM store_sales_items si WHERE si.sales_id = ss.sales_id)::int AS item_count
          FROM store_sales ss
          LEFT JOIN customers c ON c.customer_id = ss.customer_id
          WHERE ss.owner_id = ${owner_id} AND ss.created_at >= ${start} AND ss.created_at <= ${end}
          ORDER BY ss.created_at ASC
        ) s) AS sales_rows,

        (SELECT COALESCE(json_agg(row_to_json(p)), '[]'::json) FROM (
          SELECT
            dp.payment_id,
            dp.sales_id,
            dp.amount,
            dp.payment_method,
            dp.note,
            dp.created_at,
            c.full_name AS customer_name,
            c.phone AS customer_phone
          FROM store_due_payments dp
          LEFT JOIN store_sales ss ON ss.sales_id = dp.sales_id
          LEFT JOIN customers c ON c.customer_id = ss.customer_id
          WHERE dp.owner_id = ${owner_id} AND dp.created_at >= ${start} AND dp.created_at <= ${end}
          ORDER BY dp.created_at ASC
        ) p) AS due_payment_rows,

        (SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM (
          SELECT
            ex.expense_id,
            ex.amount,
            ex.note,
            ex.created_at,
            t.title AS title
          FROM store_expenses ex
          LEFT JOIN store_expense_titles t ON t.title_id = ex.title_id
          WHERE ex.owner_id = ${owner_id} AND ex.created_at >= ${start} AND ex.created_at <= ${end}
          ORDER BY ex.created_at ASC
        ) e) AS expense_rows,

        (SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json) FROM (
          SELECT
            cr.return_id,
            cr.refund_amount,
            cr.note,
            cr.created_at,
            cr.sales_id,
            c.full_name AS customer_name
          FROM store_customer_returns cr
          LEFT JOIN store_sales ss ON ss.sales_id = cr.sales_id
          LEFT JOIN customers c ON c.customer_id = ss.customer_id
          WHERE cr.owner_id = ${owner_id} AND cr.created_at >= ${start} AND cr.created_at <= ${end}
          ORDER BY cr.created_at ASC
        ) r) AS return_rows
    `;

    const sales = row.sales_rows || [];
    const duePayments = row.due_payment_rows || [];
    const expenses = row.expense_rows || [];
    const customerReturns = row.return_rows || [];

    let salesTotal = 0;
    let collectedFromTodaysSales = 0;
    const byMethod = { cash: 0, online: 0, cheque: 0 };
    const entries = [];

    for (const s of sales) {
      const effectiveTotal = Math.max(0, num(s.total_amount) - num(s.discount));
      const receivedNow = num(s.initial_paid_amount);
      salesTotal += effectiveTotal;
      collectedFromTodaysSales += receivedNow;
      if (byMethod[s.payment_method] !== undefined) {
        byMethod[s.payment_method] += receivedNow;
      }

      if (receivedNow > 0) {
        const customerLabel =
          s.customer_name || s.customer_phone || "Walk-in Customer";
        const itemCount = num(s.item_count);
        entries.push({
          entry_id: s.sales_id,
          type: "SALE",
          title: `Sale · ${s.sales_id.slice(0, 8).toUpperCase()}`,
          reference: `${customerLabel} · ${itemCount} item${itemCount === 1 ? "" : "s"}`,
          time: s.created_at,
          flow: "credit",
          amount: receivedNow,
          payment_method: s.payment_method,
          meta: {
            payment_status: s.payment_status,
            gross_amount: num(s.total_amount),
            discount: num(s.discount),
            invoice_total: effectiveTotal,
          },
        });
      }
    }

    const creditToday = Math.max(0, salesTotal - collectedFromTodaysSales);

    let duePaymentsTotal = 0;
    for (const p of duePayments) {
      const amount = num(p.amount);
      duePaymentsTotal += amount;
      if (byMethod[p.payment_method] !== undefined) {
        byMethod[p.payment_method] += amount;
      }
      const customerLabel = p.customer_name || p.customer_phone || "Customer";
      entries.push({
        entry_id: p.payment_id,
        type: "CREDIT_RECEIVED",
        title: "Credit Received",
        reference: p.note || customerLabel,
        time: p.created_at,
        flow: "credit",
        amount,
        payment_method: p.payment_method,
      });
    }

    let expensesTotal = 0;
    for (const e of expenses) {
      const amount = num(e.amount);
      expensesTotal += amount;
      entries.push({
        entry_id: e.expense_id,
        type: "EXPENSE",
        title: `Expense · ${e.title || "General"}`,
        reference: e.note || "Store expense",
        time: e.created_at,
        flow: "debit",
        amount,
      });
    }

    let returnsTotal = 0;
    for (const r of customerReturns) {
      const amount = num(r.refund_amount);
      returnsTotal += amount;
      const customerLabel = r.customer_name || "Customer";
      entries.push({
        entry_id: r.return_id,
        type: "RETURN",
        title: `Return · ${r.sales_id ? r.sales_id.slice(0, 8).toUpperCase() : ""}`,
        reference: r.note || `${customerLabel} · items returned`,
        time: r.created_at,
        flow: "debit",
        amount,
      });
    }

    entries.sort((a, b) => new Date(a.time) - new Date(b.time));

    const total_inflow = collectedFromTodaysSales + duePaymentsTotal;
    const total_outflow = expensesTotal + returnsTotal;

    const closing_balance = total_inflow - total_outflow;

    const payment_breakdown = {
      cash: byMethod.cash,
      online: byMethod.online,
      credit: creditToday,
    };
    if (byMethod.cheque > 0) {
      payment_breakdown.cheque = byMethod.cheque;
    }

    return {
      date: label,
      sales: salesTotal,
      received: total_inflow,
      expenses: expensesTotal,
      credit: creditToday,
      total_outflow,
      payment_breakdown,
      closing_balance,
      entries,
    };
  }

  /**
   * Cash-based Daybook for a date range.
   *
   * Example:
   *   from = 2026-08-01
   *   to   = 2026-08-17
   *
   * Includes:
   *   - Sales created during the selected range
   *   - Due/credit payments received during the selected range
   *   - Expenses created during the selected range
   *   - Customer returns/refunds during the selected range
   *
   * Credit = unpaid amount created from sales made during the range.
   * It is NOT counted as cash inflow.
   *
   * closing_balance = total inflow - total outflow
   */
  async getDaybookRange(owner_id, fromStr, toStr) {
    const { start, end, from, to, label } = this._resolveDateRange(
      fromStr,
      toStr,
    );

    const [row] = await prisma.$queryRaw`
    SELECT
      (
        SELECT COALESCE(
          json_agg(row_to_json(s)),
          '[]'::json
        )
        FROM (
          SELECT
            ss.sales_id,
            ss.total_amount,
            ss.discount,
            ss.initial_paid_amount,
            ss.payment_method,
            ss.payment_status,
            ss.created_at,
            c.full_name AS customer_name,
            c.phone AS customer_phone,
            (
              SELECT COUNT(*)
              FROM store_sales_items si
              WHERE si.sales_id = ss.sales_id
            )::int AS item_count
          FROM store_sales ss
          LEFT JOIN customers c
            ON c.customer_id = ss.customer_id
          WHERE
            ss.owner_id = ${owner_id}
            AND ss.created_at >= ${start}
            AND ss.created_at <= ${end}
          ORDER BY ss.created_at ASC
        ) s
      ) AS sales_rows,

      (
        SELECT COALESCE(
          json_agg(row_to_json(p)),
          '[]'::json
        )
        FROM (
          SELECT
            dp.payment_id,
            dp.sales_id,
            dp.amount,
            dp.payment_method,
            dp.note,
            dp.created_at,
            c.full_name AS customer_name,
            c.phone AS customer_phone
          FROM store_due_payments dp
          LEFT JOIN store_sales ss
            ON ss.sales_id = dp.sales_id
          LEFT JOIN customers c
            ON c.customer_id = ss.customer_id
          WHERE
            dp.owner_id = ${owner_id}
            AND dp.created_at >= ${start}
            AND dp.created_at <= ${end}
          ORDER BY dp.created_at ASC
        ) p
      ) AS due_payment_rows,

      (
        SELECT COALESCE(
          json_agg(row_to_json(e)),
          '[]'::json
        )
        FROM (
          SELECT
            ex.expense_id,
            ex.amount,
            ex.note,
            ex.created_at,
            t.title AS title
          FROM store_expenses ex
          LEFT JOIN store_expense_titles t
            ON t.title_id = ex.title_id
          WHERE
            ex.owner_id = ${owner_id}
            AND ex.created_at >= ${start}
            AND ex.created_at <= ${end}
          ORDER BY ex.created_at ASC
        ) e
      ) AS expense_rows,

      (
        SELECT COALESCE(
          json_agg(row_to_json(r)),
          '[]'::json
        )
        FROM (
          SELECT
            cr.return_id,
            cr.refund_amount,
            cr.note,
            cr.created_at,
            cr.sales_id,
            c.full_name AS customer_name
          FROM store_customer_returns cr
          LEFT JOIN store_sales ss
            ON ss.sales_id = cr.sales_id
          LEFT JOIN customers c
            ON c.customer_id = ss.customer_id
          WHERE
            cr.owner_id = ${owner_id}
            AND cr.created_at >= ${start}
            AND cr.created_at <= ${end}
          ORDER BY cr.created_at ASC
        ) r
      ) AS return_rows
  `;

    const sales = row?.sales_rows || [];
    const duePayments = row?.due_payment_rows || [];
    const expenses = row?.expense_rows || [];
    const customerReturns = row?.return_rows || [];

    // ─────────────────────────────────────────────
    // SALES
    // ─────────────────────────────────────────────

    let salesTotal = 0;
    let collectedFromRangeSales = 0;

    const byMethod = {
      cash: 0,
      online: 0,
      cheque: 0,
    };

    const entries = [];

    for (const s of sales) {
      const grossAmount = num(s.total_amount);
      const discount = num(s.discount);

      const effectiveTotal = Math.max(0, grossAmount - discount);

      const receivedNow = num(s.initial_paid_amount);

      salesTotal += effectiveTotal;
      collectedFromRangeSales += receivedNow;

      if (s.payment_method && byMethod[s.payment_method] !== undefined) {
        byMethod[s.payment_method] += receivedNow;
      }

      /*
       * Only create an inflow entry when money
       * was actually received at sale time.
       */
      if (receivedNow > 0) {
        const customerLabel =
          s.customer_name || s.customer_phone || "Walk-in Customer";

        const itemCount = num(s.item_count);

        entries.push({
          entry_id: s.sales_id,
          type: "SALE",

          title: `Sale · ${s.sales_id.slice(0, 8).toUpperCase()}`,

          reference:
            `${customerLabel} · ` +
            `${itemCount} item` +
            `${itemCount === 1 ? "" : "s"}`,

          time: s.created_at,

          flow: "credit",

          amount: receivedNow,

          payment_method: s.payment_method,

          meta: {
            payment_status: s.payment_status,

            gross_amount: grossAmount,

            discount,

            invoice_total: effectiveTotal,
          },
        });
      }
    }

    /*
     * Credit generated from sales made
     * during the selected range.
     *
     * This is NOT cash received.
     */
    const creditTotal = Math.max(0, salesTotal - collectedFromRangeSales);

    // ─────────────────────────────────────────────
    // CREDIT / DUE PAYMENTS RECEIVED
    // ─────────────────────────────────────────────

    let duePaymentsTotal = 0;

    for (const p of duePayments) {
      const amount = num(p.amount);

      duePaymentsTotal += amount;

      if (p.payment_method && byMethod[p.payment_method] !== undefined) {
        byMethod[p.payment_method] += amount;
      }

      const customerLabel = p.customer_name || p.customer_phone || "Customer";

      entries.push({
        entry_id: p.payment_id,

        type: "CREDIT_RECEIVED",

        title: "Credit Received",

        reference: p.note || customerLabel,

        time: p.created_at,

        flow: "credit",

        amount,

        payment_method: p.payment_method,
      });
    }

    // ─────────────────────────────────────────────
    // EXPENSES
    // ─────────────────────────────────────────────

    let expensesTotal = 0;

    for (const e of expenses) {
      const amount = num(e.amount);

      expensesTotal += amount;

      entries.push({
        entry_id: e.expense_id,

        type: "EXPENSE",

        title: `Expense · ${e.title || "General"}`,

        reference: e.note || "Store expense",

        time: e.created_at,

        flow: "debit",

        amount,
      });
    }

    // ─────────────────────────────────────────────
    // CUSTOMER RETURNS
    // ─────────────────────────────────────────────

    let returnsTotal = 0;

    for (const r of customerReturns) {
      const amount = num(r.refund_amount);

      returnsTotal += amount;

      const customerLabel = r.customer_name || "Customer";

      entries.push({
        entry_id: r.return_id,

        type: "RETURN",

        title: `Return · ${
          r.sales_id ? r.sales_id.slice(0, 8).toUpperCase() : ""
        }`,

        reference: r.note || `${customerLabel} · items returned`,

        time: r.created_at,

        flow: "debit",

        amount,
      });
    }

    // ─────────────────────────────────────────────
    // SORT TRANSACTIONS
    // ─────────────────────────────────────────────

    entries.sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
    );

    // ─────────────────────────────────────────────
    // TOTALS
    // ─────────────────────────────────────────────

    const total_inflow = collectedFromRangeSales + duePaymentsTotal;

    const total_outflow = expensesTotal + returnsTotal;

    const closing_balance = total_inflow - total_outflow;

    // ─────────────────────────────────────────────
    // PAYMENT BREAKDOWN
    // ─────────────────────────────────────────────

    const payment_breakdown = {
      cash: byMethod.cash,
      online: byMethod.online,
      credit: creditTotal,
    };

    if (byMethod.cheque > 0) {
      payment_breakdown.cheque = byMethod.cheque;
    }

    // ─────────────────────────────────────────────
    // RESPONSE
    // ─────────────────────────────────────────────

    return {
      from,
      to,

      // Kept so frontend can use the same
      // field used by single-day response.
      date: label,

      sales: salesTotal,

      received: total_inflow,

      expenses: expensesTotal,

      credit: creditTotal,

      total_outflow,

      payment_breakdown,

      closing_balance,

      entries,
    };
  }

  _resolveDateRange(fromStr, toStr) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!fromStr || !toStr) {
      const e = new Error("Both 'from' and 'to' dates are required.");

      e.status = 400;
      e.code = "VALIDATION_RANGE_INCOMPLETE";

      throw e;
    }

    if (!dateRegex.test(fromStr) || !dateRegex.test(toStr)) {
      const e = new Error("Invalid date format. Use YYYY-MM-DD.");

      e.status = 400;
      e.code = "VALIDATION_DATE_INVALID";

      throw e;
    }

    /*
     * Using NPT helpers ensures:
     *
     * from = beginning of selected NPT day
     * to   = end of selected NPT day
     */
    const start = parseNPTDateStart(fromStr);

    const end = parseNPTDateEnd(toStr);

    if (start.getTime() > end.getTime()) {
      const e = new Error("'from' date cannot be after 'to' date.");

      e.status = 400;
      e.code = "VALIDATION_RANGE_INVALID";

      throw e;
    }

    return {
      start,
      end,

      from: fromStr,
      to: toStr,

      label: fromStr === toStr ? fromStr : `${fromStr} - ${toStr}`,
    };
  }

  _resolveDayRange(dateStr) {
    let start, end, label;

    if (dateStr) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const e = new Error("Invalid date format. Use YYYY-MM-DD.");
        e.status = 400;
        e.code = "VALIDATION_DATE_INVALID";
        throw e;
      }
      start = parseNPTDateStart(dateStr);
      end = parseNPTDateEnd(dateStr);
      label = dateStr;
    } else {
      start = todayStartUTC();
      end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
      const npt = new Date(start.getTime() + NPT_OFFSET_MS);
      label = `${npt.getUTCFullYear()}-${String(npt.getUTCMonth() + 1).padStart(2, "0")}-${String(
        npt.getUTCDate(),
      ).padStart(2, "0")}`;
    }

    return { start, end, label };
  }
}

export default new StoreSaleDaybookService();
