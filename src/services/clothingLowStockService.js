const { prisma } = require("../prisma/client");
const { sendClothingLowStockNotification } = require("./notificationService");

class ClothingLowStockService {
  async listLowStock(owner_id, threshold = 40) {
    const th = Number(threshold);
    if (!Number.isFinite(th) || th <= 0) {
      const e = new Error("threshold must be a positive number");
      e.status = 400;
      e.code = "VALIDATION_THRESHOLD_INVALID";
      throw e;
    }

    const grouped = await prisma.clothingStockLot.groupBy({
      by: ["product_id"],
      where: { product: { owner_id } },
      _sum: { qty_remaining: true },
    });

    const mapSum = new Map(
      grouped.map(g => [g.product_id, Number(g._sum.qty_remaining || 0)])
    );

    const lowProductIds = grouped
      .filter(g => Number(g._sum.qty_remaining || 0) < th)
      .map(g => g.product_id);

    if (lowProductIds.length === 0) return [];

    const products = await prisma.clothingProduct.findMany({
      where: { owner_id, product_id: { in: lowProductIds } },
      select: {
        product_id: true,
        product_name: true,
        last_low_stock_notified_at: true,
        category: { select: { category_name: true } },
      },
    });

    return products
      .map(p => ({ ...p, qty_remaining: mapSum.get(p.product_id) ?? 0 }))
      .sort((a, b) => a.qty_remaining - b.qty_remaining);
  }

  async notifyLowStock(owner_id, threshold = 40) {
    const owner = await prisma.owner.findUnique({
      where: { owner_id },
      select: { owner_id: true, fcm_token: true },
    });

    if (!owner) {
      const e = new Error("Owner not found");
      e.status = 404;
      e.code = "OWNER_NOT_FOUND";
      throw e;
    }

    const low = await this.listLowStock(owner_id, threshold);
    if (low.length === 0) return { notified: 0, items: [] };

    // ✅ Use SAME 24h rule as cron
    const now = new Date();
    const toNotify = low.filter(p => {
      if (!p.last_low_stock_notified_at) return true;
      const hours = (now - new Date(p.last_low_stock_notified_at)) / (1000 * 60 * 60);
      return hours >= 24;
    });

    for (const p of toNotify) {
      await sendClothingLowStockNotification({
        owner_id,
        fcmToken: owner.fcm_token,
        productId: p.product_id,
        productName: p.product_name,
        remainingQty: p.qty_remaining,
      });

      await prisma.clothingProduct.update({
        where: { product_id: p.product_id },
        data: { last_low_stock_notified_at: now },
      });
    }

    return { notified: toNotify.length, items: low };
  }
}

module.exports = new ClothingLowStockService();
