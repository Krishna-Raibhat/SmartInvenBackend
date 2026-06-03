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

    const startFinal =
      startDate ||
      (() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
      })();

    const endFinal = endDate || new Date();

    // 1) Header totals
    const salesTotals = await prisma.$queryRaw`
      SELECT 
        COALESCE(SUM(total_amount), 0)::numeric AS total_amount,
        COALESCE(SUM(discount), 0)::numeric AS total_discount,
        COALESCE(SUM(paid_amount), 0)::numeric AS total_paid,
        COALESCE(SUM(GREATEST(total_amount - COALESCE(discount, 0), 0)), 0)::numeric AS effective_total,
        COUNT(sales_id)::int AS sales_count
      FROM clothing_sales
      WHERE owner_id = ${owner_id}
        AND created_at >= ${startFinal}
        AND created_at <= ${endFinal}
    `;

    const row = salesTotals[0];
    const totalSales = Number(row.total_amount || 0);
    const totalDiscount = Number(row.total_discount || 0);
    const totalPaid = Number(row.total_paid || 0);
    const effectiveTotal = Number(row.effective_total || 0);
    const salesCount = Number(row.sales_count || 0);
    const creditRemaining = Math.max(0, effectiveTotal - totalPaid);

    // 2) Total products count
    const totalProducts = await prisma.clothingProduct.count({
      where: { owner_id },
    });

    // 3) Stock-in qty
    const stockInAgg = await prisma.clothingStockLot.aggregate({
      where: {
        created_at: { gte: startFinal, lte: endFinal },
        product: { owner_id },
      },
      _sum: { qty_in: true },
      _count: { lot_id: true },
    });

    const stockInQty = Number(stockInAgg._sum.qty_in || 0);
    const stockInLots = Number(stockInAgg._count.lot_id || 0);

    // 4) Stock-out qty
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

    // 5) ✅ CORRECT PROFIT CALCULATION
    //    Revenue = effective_total - refund_amount
    //    Cost = sold_cost - returned_cost_good (only GOOD returns go back to stock → cost recovered)
    //    Damaged returns are a true loss — their cost is NOT recovered
    //    Profit = Revenue - Net Cost
    const rows = await prisma.$queryRaw`
      WITH sold AS (
        SELECT
          cs.sales_id,
          GREATEST(cs.total_amount - COALESCE(cs.discount, 0), 0) AS effective_total,
          COALESCE(SUM(csi.cp * csi.qty), 0) AS sold_cost
        FROM clothing_sales_items csi
        JOIN clothing_sales cs ON cs.sales_id = csi.sales_id
        WHERE cs.owner_id = ${owner_id}
          AND cs.created_at >= ${startFinal}
          AND cs.created_at <= ${endFinal}
        GROUP BY cs.sales_id, cs.total_amount, cs.discount
      ),
      returns AS (
        SELECT
          ccr.sales_id,
          COALESCE(SUM(ccr.refund_amount), 0) AS total_refund,
          COALESCE(SUM(CASE WHEN LOWER(ccri.condition) = 'good' THEN ccri.qty ELSE 0 END), 0) AS returned_good_qty,
          COALESCE(SUM(ccri.qty), 0) AS returned_all_qty,
          COALESCE(SUM(CASE WHEN LOWER(ccri.condition) = 'good' THEN csi.cp * ccri.qty ELSE 0 END), 0) AS returned_cost
        FROM clothing_customer_returns ccr
        INNER JOIN sold s ON s.sales_id = ccr.sales_id
        LEFT JOIN clothing_customer_return_items ccri ON ccri.return_id = ccr.return_id
        LEFT JOIN clothing_sales_items csi ON csi.sales_item_id = ccri.sales_item_id
        WHERE ccr.owner_id = ${owner_id}
        GROUP BY ccr.sales_id
      ),
      all_returns AS (
        SELECT 
          COALESCE(SUM(ccri.qty), 0) AS returned_all_qty
        FROM clothing_customer_return_items ccri
        JOIN clothing_customer_returns ccr ON ccr.return_id = ccri.return_id
        INNER JOIN sold s ON s.sales_id = ccr.sales_id
        WHERE ccr.owner_id = ${owner_id}
      )
      SELECT
        COALESCE(SUM(s.effective_total), 0) - COALESCE(SUM(r.total_refund), 0) AS actual_revenue,
        -- Cost = sold cost minus cost of good returned items (they went back to stock)
        COALESCE(SUM(s.sold_cost), 0) - COALESCE(SUM(r.returned_cost), 0) AS total_cost,
        COALESCE(SUM(r.returned_good_qty), 0) AS returned_good_qty,
        (SELECT returned_all_qty FROM all_returns) AS returned_all_qty
      FROM sold s
      LEFT JOIN returns r ON r.sales_id = s.sales_id
    `;

    const actualRevenue = Number(rows?.[0]?.actual_revenue || 0);
    const totalCost = Number(rows?.[0]?.total_cost || 0);
    const returnedGoodQty = Number(rows?.[0]?.returned_good_qty || 0);
    const returnedAllQty = Number(rows?.[0]?.returned_all_qty || 0);

    const netStockOutQty = Math.max(0, stockOutQtySold - returnedGoodQty);
    const profitOrLoss = actualRevenue - totalCost;

    return {
      range: { start: startFinal, end: endFinal },
      totals: {
        total_sales: effectiveTotal,
        total_discount: totalDiscount,
        effective_total: actualRevenue,
        total_paid: totalPaid,
        credit_remaining: Math.max(0, actualRevenue - totalPaid),
        actual_revenue: actualRevenue,
        total_cost: totalCost,
        profit_or_loss: profitOrLoss,
      },
      counts: {
        total_products: totalProducts,
        total_sales_bills: salesCount,
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