const cron = require("node-cron");
const { prisma } = require("../prisma/client");
const { sendClothingLowStockNotification } = require("../services/notificationService");

const LOW_STOCK_THRESHOLD = 40;

cron.schedule(
  "* * * * *", // every minute
  async () => {
    try {
      console.log("👕 Running clothing low stock cron");

      const owners = await prisma.owner.findMany({
        select: { owner_id: true, fcm_token: true },
      });

      for (const owner of owners) {
        const sums = await prisma.clothingStockLot.groupBy({
          by: ["product_id"],
          where: {
            product: { owner_id: owner.owner_id },
          },
          _sum: { qty_remaining: true },
        });

        if (!sums.length) continue;

        const stockMap = new Map(
          sums.map(x => [x.product_id, Number(x._sum.qty_remaining || 0)])
        );

        const products = await prisma.clothingProduct.findMany({
          where: {
            owner_id: owner.owner_id,
            product_id: { in: [...stockMap.keys()] },
          },
          select: {
            product_id: true,
            product_name: true,
            last_low_stock_notified_at: true,
          },
        });

        const now = new Date();

        for (const p of products) {
          const remainingQty = stockMap.get(p.product_id) ?? 0;

          // reset if stock normal
          if (remainingQty >= LOW_STOCK_THRESHOLD && p.last_low_stock_notified_at) {
            await prisma.clothingProduct.update({
              where: { product_id: p.product_id },
              data: { last_low_stock_notified_at: null },
            });
            continue;
          }

          if (remainingQty >= LOW_STOCK_THRESHOLD) continue;

          const last = p.last_low_stock_notified_at;
          const hours =
            last ? (now - new Date(last)) / (1000 * 60 * 60) : Infinity;

          if (hours < 24) continue;

          await sendClothingLowStockNotification({
            owner_id: owner.owner_id,
            fcmToken: owner.fcm_token,
            productId: p.product_id,
            productName: p.product_name,
            remainingQty,
          });

          await prisma.clothingProduct.update({
            where: { product_id: p.product_id },
            data: { last_low_stock_notified_at: now },
          });
        }
      }
    } catch (err) {
      console.error("❌ Clothing low stock cron error:", err.message);
    }
  },
  { timezone: "Asia/Kathmandu" }
);
