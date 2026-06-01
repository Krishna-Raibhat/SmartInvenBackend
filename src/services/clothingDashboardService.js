// src/services/clothingDashboardService.js
import { prisma } from "../prisma/client.js";

function parseDateOrNull(x) {
  if (!x) return null;
  const d = new Date(x);
  return Number.isNaN(d.getTime()) ? null : d;
}

class ClothingDashboardService {
  async summary(owner_id, { start, end } = {}) {
    const startDate = parseDateOrNull(start);
    const endDate = parseDateOrNull(end);

    // default: today 00:00 -> now (Asia/Kathmandu handled by DB timezone; ok for most cases)
    const startFinal =
      startDate ||
      (() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
      })();

    const endFinal = endDate || new Date();

    // 1) Header totals (for display purposes)
    const salesAgg = await prisma.clothingSales.aggregate({
      where: {
        owner_id,
        created_at: { gte: startFinal, lte: endFinal },
      },
      _sum: {
        total_amount: true,
        discount: true,
        paid_amount: true,
      },
      _count: { sales_id: true },
    });

    const totalSales = Number(salesAgg._sum.total_amount || 0);
    const totalDiscount = Number(salesAgg._sum.discount || 0);
    const totalPaid = Number(salesAgg._sum.paid_amount || 0);
    const effectiveTotal = totalSales - totalDiscount;
    const creditRemaining = Math.max(0, effectiveTotal - totalPaid);

    // 2) Total products count
    const totalProducts = await prisma.clothingProduct.count({
      where: { owner_id },
    });

    // 3) Stock-in qty (lots created in time range)
    const stockInAgg = await prisma.clothingStockLot.aggregate({
      where: {
        created_at: { gte: startFinal, lte: endFinal },
        product: { owner_id }, // owner-safe
      },
      _sum: { qty_in: true },
      _count: { lot_id: true },
    });

    const stockInQty = Number(stockInAgg._sum.qty_in || 0);
    const stockInLots = Number(stockInAgg._count.lot_id || 0);

    // 4) Stock-out qty (sold qty) in range
    const stockOutAgg = await prisma.clothingSalesItem.aggregate({
      where: {
        sales: {
          owner_id,
          created_at: { gte: startFinal, lte: endFinal },
        },
      },
      _sum: { qty: true },
    });

    const stockOutQtySold = Number(stockOutAgg._sum.qty || 0);

    // 5) ✅ CASH BASIS: Revenue = paid_amount - discount (proportional)
    //    Cost = sum(cp * qty sold) - sum(cp * qty returned where condition='good')
    const rows = await prisma.$queryRaw`
      WITH sold AS (
        SELECT
          cs.sales_id,
          cs.total_amount,
          cs.discount,
          cs.paid_amount,
          -- effective = post-discount total; this is the correct denominator
          GREATEST(cs.total_amount - cs.discount, 0) AS effective_total,
          COALESCE(SUM(csi.cp * csi.qty), 0) AS sold_cost,
          COALESCE(SUM(csi.sp * csi.qty), 0) AS sold_sp_total
        FROM clothing_sales_items csi
        JOIN clothing_sales cs ON cs.sales_id = csi.sales_id
        WHERE cs.owner_id = ${owner_id}
          AND cs.created_at >= ${startFinal}
          AND cs.created_at <= ${endFinal}
        GROUP BY cs.sales_id, cs.total_amount, cs.discount, cs.paid_amount
      ),
      returned_good AS (
        SELECT
          cs.sales_id,
          COALESCE(SUM(csi.cp * ccri.qty), 0) AS returned_cost,
          COALESCE(SUM(csi.sp * ccri.qty), 0) AS returned_sp_total,
          COALESCE(SUM(ccri.qty), 0)           AS returned_good_qty
        FROM clothing_customer_return_items ccri
        JOIN clothing_customer_returns ccr ON ccr.return_id = ccri.return_id
        JOIN clothing_sales_items csi       ON csi.sales_item_id = ccri.sales_item_id
        JOIN clothing_sales cs              ON cs.sales_id = csi.sales_id
        WHERE ccr.owner_id = ${owner_id}
          AND ccr.created_at >= ${startFinal}
          AND ccr.created_at <= ${endFinal}
          AND ccri.condition = 'good'
        GROUP BY cs.sales_id
      ),
      returned_all AS (
        SELECT COALESCE(SUM(ccri.qty), 0) AS returned_all_qty
        FROM clothing_customer_return_items ccri
        JOIN clothing_customer_returns ccr ON ccr.return_id = ccri.return_id
        WHERE ccr.owner_id = ${owner_id}
          AND ccr.created_at >= ${startFinal}
          AND ccr.created_at <= ${endFinal}
      )
      SELECT
        -- Bug 1 + 2 fix: use effective_total as denominator, apply same ratio to returns
        COALESCE(SUM(
          CASE
            WHEN s.effective_total > 0
            THEN (s.paid_amount / s.effective_total)
                * (s.sold_sp_total - COALESCE(rg.returned_sp_total, 0))
            ELSE 0
          END
        ), 0) AS actual_revenue,

        -- Cost: full COGS minus returned-good items (cost is not credit-dependent)
        COALESCE(SUM(s.sold_cost - COALESCE(rg.returned_cost, 0)), 0) AS total_cost,

        COALESCE(SUM(COALESCE(rg.returned_good_qty, 0)), 0) AS returned_good_qty,
        (SELECT returned_all_qty FROM returned_all)          AS returned_all_qty
      FROM sold s
      LEFT JOIN returned_good rg ON rg.sales_id = s.sales_id
    `;

    const actualRevenue = Number(rows?.[0]?.actual_revenue || 0);
    const totalCost = Number(rows?.[0]?.total_cost || 0);
    const returnedGoodQty = Number(rows?.[0]?.returned_good_qty || 0);
    const returnedAllQty = Number(rows?.[0]?.returned_all_qty || 0);

    // net stock out qty = sold - returned_good (because good returns go back to stock)
    const netStockOutQty = Math.max(0, stockOutQtySold - returnedGoodQty);

    const profitOrLoss = actualRevenue - totalCost;

    return {
      range: { start: startFinal, end: endFinal },

      totals: {
        total_sales: totalSales,
        total_discount: totalDiscount,
        effective_total: effectiveTotal,
        total_paid: totalPaid,
        credit_remaining: creditRemaining,

        actual_revenue: actualRevenue, // ✅ Only paid portion
        total_cost: totalCost,
        profit_or_loss: profitOrLoss, // ✅ Cash basis
      },

      counts: {
        total_products: totalProducts,
        total_sales_bills: Number(salesAgg._count.sales_id || 0),

        stock_in_lots: stockInLots,
        stock_in_qty: stockInQty,

        stock_out_qty_sold: stockOutQtySold,
        returned_qty_all: returnedAllQty,
        returned_qty_good: returnedGoodQty,
        stock_out_qty_net: netStockOutQty,
      },
    };
  }
}

export default new ClothingDashboardService();
