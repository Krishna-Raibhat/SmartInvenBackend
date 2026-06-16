// src/services/storeReportService.js
import { prisma } from "../prisma/client.js";

function getDateRanges() {
  const now = new Date();

  // Today
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  // Last 7 days
  const last7Start = new Date(now);
  last7Start.setDate(now.getDate() - 6);
  last7Start.setHours(0, 0, 0, 0);

  // This month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);

  return { todayStart, todayEnd, last7Start, monthStart, now };
}

class StoreDashboardReportService {
  async getSummary(owner_id) {
    const { todayStart, todayEnd, last7Start, monthStart, now } = getDateRanges();

    // ── 1. Sales aggregates for each period ──────────────────────────
    const [
      salesToday,
      salesLast7,
      salesMonth,
      salesAllTime,
    ] = await Promise.all([
      prisma.storeSales.aggregate({
        where: { owner_id, created_at: { gte: todayStart, lte: todayEnd } },
        _sum: { total_amount: true, discount: true, paid_amount: true },
        _count: { sales_id: true },
      }),
      prisma.storeSales.aggregate({
        where: { owner_id, created_at: { gte: last7Start, lte: now } },
        _sum: { total_amount: true, discount: true, paid_amount: true },
        _count: { sales_id: true },
      }),
      prisma.storeSales.aggregate({
        where: { owner_id, created_at: { gte: monthStart, lte: now } },
        _sum: { total_amount: true, discount: true, paid_amount: true },
        _count: { sales_id: true },
      }),
      prisma.storeSales.aggregate({
        where: { owner_id },
        _sum: { total_amount: true, discount: true, paid_amount: true },
        _count: { sales_id: true },
      }),
    ]);

    // ── 2. COGS for each period (from sales items) ───────────────────
    const [cogsToday, cogsLast7, cogsMonth, cogsAllTime] = await Promise.all([
      prisma.storeSalesItem.aggregate({
        where: { owner_id, sales: { created_at: { gte: todayStart, lte: todayEnd } } },
        _sum: { line_total: true, qty: true },
      }),
      prisma.storeSalesItem.aggregate({
        where: { owner_id, sales: { created_at: { gte: last7Start, lte: now } } },
        _sum: { line_total: true, qty: true },
      }),
      prisma.storeSalesItem.aggregate({
        where: { owner_id, sales: { created_at: { gte: monthStart, lte: now } } },
        _sum: { line_total: true, qty: true },
      }),
      prisma.storeSalesItem.aggregate({
        where: { owner_id },
        _sum: { line_total: true, qty: true },
      }),
    ]);

    // ── 3. COGS raw (cp * qty) per period ───────────────────────────
    const [rawCogsToday, rawCogsLast7, rawCogsMonth, rawCogsAllTime] =
      await Promise.all([
        prisma.$queryRaw`
          SELECT COALESCE(SUM(si.cp * si.qty), 0)::numeric AS cogs
          FROM store_sales_items si
          JOIN store_sales s ON s.sales_id = si.sales_id
          WHERE si.owner_id = ${owner_id}
            AND s.created_at >= ${todayStart}
            AND s.created_at <= ${todayEnd}
            AND si.cp IS NOT NULL
        `,
        prisma.$queryRaw`
          SELECT COALESCE(SUM(si.cp * si.qty), 0)::numeric AS cogs
          FROM store_sales_items si
          JOIN store_sales s ON s.sales_id = si.sales_id
          WHERE si.owner_id = ${owner_id}
            AND s.created_at >= ${last7Start}
            AND s.created_at <= ${now}
            AND si.cp IS NOT NULL
        `,
        prisma.$queryRaw`
          SELECT COALESCE(SUM(si.cp * si.qty), 0)::numeric AS cogs
          FROM store_sales_items si
          JOIN store_sales s ON s.sales_id = si.sales_id
          WHERE si.owner_id = ${owner_id}
            AND s.created_at >= ${monthStart}
            AND s.created_at <= ${now}
            AND si.cp IS NOT NULL
        `,
        prisma.$queryRaw`
          SELECT COALESCE(SUM(si.cp * si.qty), 0)::numeric AS cogs
          FROM store_sales_items si
          WHERE si.owner_id = ${owner_id}
            AND si.cp IS NOT NULL
        `,
      ]);

    // ── 4. Returns per period ────────────────────────────────────────
    const [returnsToday, returnsLast7, returnsMonth, returnsAllTime] =
      await Promise.all([
        prisma.storeCustomerReturn.aggregate({
          where: { owner_id, created_at: { gte: todayStart, lte: todayEnd } },
          _sum: { refund_amount: true },
        }),
        prisma.storeCustomerReturn.aggregate({
          where: { owner_id, created_at: { gte: last7Start, lte: now } },
          _sum: { refund_amount: true },
        }),
        prisma.storeCustomerReturn.aggregate({
          where: { owner_id, created_at: { gte: monthStart, lte: now } },
          _sum: { refund_amount: true },
        }),
        prisma.storeCustomerReturn.aggregate({
          where: { owner_id },
          _sum: { refund_amount: true },
        }),
      ]);

    // ── 5. Expenses per period ───────────────────────────────────────
    const [expToday, expLast7, expMonth, expAllTime] = await Promise.all([
      prisma.storeExpense.aggregate({
        where: { owner_id, created_at: { gte: todayStart, lte: todayEnd } },
        _sum: { amount: true },
      }),
      prisma.storeExpense.aggregate({
        where: { owner_id, created_at: { gte: last7Start, lte: now } },
        _sum: { amount: true },
      }),
      prisma.storeExpense.aggregate({
        where: { owner_id, created_at: { gte: monthStart, lte: now } },
        _sum: { amount: true },
      }),
      prisma.storeExpense.aggregate({
        where: { owner_id },
        _sum: { amount: true },
      }),
    ]);

    // ── 6. Total dues (all time — dues don't belong to a period) ────
    const duesAgg = await prisma.storeSales.aggregate({
      where: { owner_id, due_amount: { gt: 0 } },
      _sum: { due_amount: true },
      _count: { sales_id: true },
    });

    // ── 7. Shape each period ─────────────────────────────────────────
    const shape = (salesAgg, cogsRaw, returnsAgg, expAgg) => {
      const grossSales = Number(salesAgg._sum.total_amount ?? 0);
      const discount   = Number(salesAgg._sum.discount ?? 0);
      const netSales   = grossSales - discount;
      const refunds    = Number(returnsAgg._sum.refund_amount ?? 0);
      const cogs       = Number(cogsRaw[0]?.cogs ?? 0);
      const expenses   = Number(expAgg._sum.amount ?? 0);
      const grossProfit = netSales - cogs;
      const netProfit   = grossProfit - refunds - expenses;
      const orders      = salesAgg._count.sales_id;

      return {
        gross_sales:   Number(grossSales.toFixed(2)),
        discount:      Number(discount.toFixed(2)),
        net_sales:     Number(netSales.toFixed(2)),
        refunds:       Number(refunds.toFixed(2)),
        cogs:          Number(cogs.toFixed(2)),
        gross_profit:  Number(grossProfit.toFixed(2)),
        expenses:      Number(expenses.toFixed(2)),
        net_profit:    Number(netProfit.toFixed(2)),
        orders,
        margin_percent:
          netSales > 0
            ? Number(((grossProfit / netSales) * 100).toFixed(1))
            : 0,
      };
    };

    return {
      today:      shape(salesToday,   rawCogsToday,   returnsToday,   expToday),
      last_7_days: shape(salesLast7,  rawCogsLast7,   returnsLast7,   expLast7),
      this_month:  shape(salesMonth,  rawCogsMonth,   returnsMonth,   expMonth),
      all_time:    shape(salesAllTime, rawCogsAllTime, returnsAllTime, expAllTime),
      dues: {
        total_due:     Number(Number(duesAgg._sum.due_amount ?? 0).toFixed(2)),
        pending_orders: duesAgg._count.sales_id,
      },
    };
  }
}

export default new StoreDashboardReportService();