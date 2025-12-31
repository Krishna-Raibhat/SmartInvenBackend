// src/services/clothingDashboardService.js
const { prisma } = require("../prisma/client");

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

    // 1) Header totals (already adjusted by returns in your services)
    const salesAgg = await prisma.clothingSales.aggregate({
      where: {
        owner_id,
        created_at: { gte: startFinal, lte: endFinal },
      },
      _sum: {
        total_amount: true,
        paid_amount: true,
      },
      _count: { sales_id: true },
    });

    const totalSales = Number(salesAgg._sum.total_amount || 0);
    const totalPaid = Number(salesAgg._sum.paid_amount || 0);
    const creditRemaining = Math.max(0, totalSales - totalPaid);

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

    // 5) Cost = sum(cp * qty sold) - sum(cp * qty returned where condition='good')
    // We use SQL because Prisma aggregate can't do SUM(cp*qty) directly.
    const rows = await prisma.$queryRaw`
      WITH sold AS (
        SELECT
          COALESCE(SUM(csi.cp * csi.qty), 0) AS sold_cost
        FROM clothing_sales_items csi
        JOIN clothing_sales cs ON cs.sales_id = csi.sales_id
        WHERE cs.owner_id = ${owner_id}
          AND cs.created_at >= ${startFinal}
          AND cs.created_at <= ${endFinal}
      ),
      returned_good AS (
        SELECT
          COALESCE(SUM(csi.cp * ccri.qty), 0) AS returned_good_cost,
          COALESCE(SUM(ccri.qty), 0) AS returned_good_qty
        FROM clothing_customer_return_items ccri
        JOIN clothing_customer_returns ccr ON ccr.return_id = ccri.return_id
        JOIN clothing_sales_items csi ON csi.sales_item_id = ccri.sales_item_id
        WHERE ccr.owner_id = ${owner_id}
          AND ccr.created_at >= ${startFinal}
          AND ccr.created_at <= ${endFinal}
          AND ccri.condition = 'good'
      ),
      returned_all AS (
        SELECT
          COALESCE(SUM(ccri.qty), 0) AS returned_all_qty
        FROM clothing_customer_return_items ccri
        JOIN clothing_customer_returns ccr ON ccr.return_id = ccri.return_id
        WHERE ccr.owner_id = ${owner_id}
          AND ccr.created_at >= ${startFinal}
          AND ccr.created_at <= ${endFinal}
      )
      SELECT
        (SELECT sold_cost FROM sold) AS sold_cost,
        (SELECT returned_good_cost FROM returned_good) AS returned_good_cost,
        (SELECT returned_good_qty FROM returned_good) AS returned_good_qty,
        (SELECT returned_all_qty FROM returned_all) AS returned_all_qty
    `;

    const soldCost = Number(rows?.[0]?.sold_cost || 0);
    const returnedGoodCost = Number(rows?.[0]?.returned_good_cost || 0);
    const returnedGoodQty = Number(rows?.[0]?.returned_good_qty || 0);
    const returnedAllQty = Number(rows?.[0]?.returned_all_qty || 0);

    const totalCost = Math.max(0, soldCost - returnedGoodCost);

    // net stock out qty = sold - returned_good (because good returns go back to stock)
    const netStockOutQty = Math.max(0, stockOutQtySold - returnedGoodQty);

    const profitOrLoss = totalSales - totalCost;

    return {
      range: { start: startFinal, end: endFinal },

      totals: {
        total_sales: totalSales,
        total_paid: totalPaid,
        credit_remaining: creditRemaining,

        total_cost: totalCost,
        profit_or_loss: profitOrLoss, // can be negative (loss)
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

module.exports = new ClothingDashboardService();
