const cron = require("node-cron");
const { prisma } = require("../prisma/client");
const { sendLowStockNotification } = require("../services/notificationService");
const { sendClothingLowStockNotification } = require("../services/clothingNotificationService");

const LOW_STOCK_THRESHOLD = 40;
const COOLDOWN_HOURS = 24;

cron.schedule(
  "*/5 * * * *", // ✅ every 5 minutes (SAFE)
  async () => {
    console.log("🔁 Running unified low stock cron");

    try {
      const owners = await prisma.owner.findMany({
        select: { owner_id: true, fcm_token: true },
      });

      const now = new Date();

      for (const owner of owners) {
        const ownerId = owner.owner_id;

        /* ===============================
           🧰 HARDWARE LOW STOCK
        =============================== */
        const hardwareSums = await prisma.hardwareStockLot.groupBy({
          by: ["product_id"],
          where: { owner_id: ownerId },
          _sum: { qty_remaining: true },
        });

        if (hardwareSums.length) {
          const hwMap = new Map(
            hardwareSums.map(x => [x.product_id, Number(x._sum.qty_remaining || 0)])
          );

          const hwProducts = await prisma.hardwareProduct.findMany({
            where: {
              owner_id: ownerId,
              product_id: { in: [...hwMap.keys()] },
            },
            select: {
              product_id: true,
              product_name: true,
              last_low_stock_notified_at: true,
            },
          });

          for (const p of hwProducts) {
            const remaining = hwMap.get(p.product_id) ?? 0;

            // reset when normal
            if (remaining >= LOW_STOCK_THRESHOLD && p.last_low_stock_notified_at) {
              await prisma.hardwareProduct.update({
                where: { product_id: p.product_id },
                data: { last_low_stock_notified_at: null },
              });
              continue;
            }

            if (remaining >= LOW_STOCK_THRESHOLD) continue;

            const last = p.last_low_stock_notified_at;
            const hours =
              last ? (now - new Date(last)) / (1000 * 60 * 60) : Infinity;

            if (hours < COOLDOWN_HOURS) continue;

            await sendLowStockNotification({
              owner_id: ownerId,
              fcmToken: owner.fcm_token ?? null,
              productId: p.product_id,
              productName: p.product_name,
              remainingQty: remaining,
            });

            await prisma.hardwareProduct.update({
              where: { product_id: p.product_id },
              data: { last_low_stock_notified_at: now },
            });
          }
        }

        /* ===============================
           👕 CLOTHING LOW STOCK
        =============================== */
        const clothingSums = await prisma.clothingStockLot.groupBy({
          by: ["product_id"],
          where: { product: { owner_id: ownerId } },
          _sum: { qty_remaining: true },
        });

        if (clothingSums.length) {
          const clMap = new Map(
            clothingSums.map(x => [x.product_id, Number(x._sum.qty_remaining || 0)])
          );

          const clProducts = await prisma.clothingProduct.findMany({
            where: {
              owner_id: ownerId,
              product_id: { in: [...clMap.keys()] },
            },
            select: {
              product_id: true,
              product_name: true,
              last_low_stock_notified_at: true,
            },
          });

          for (const p of clProducts) {
            const remaining = clMap.get(p.product_id) ?? 0;

            if (remaining >= LOW_STOCK_THRESHOLD && p.last_low_stock_notified_at) {
              await prisma.clothingProduct.update({
                where: { product_id: p.product_id },
                data: { last_low_stock_notified_at: null },
              });
              continue;
            }

            if (remaining >= LOW_STOCK_THRESHOLD) continue;

            const last = p.last_low_stock_notified_at;
            const hours =
              last ? (now - new Date(last)) / (1000 * 60 * 60) : Infinity;

            if (hours < COOLDOWN_HOURS) continue;

            await sendClothingLowStockNotification({
              owner_id: ownerId,
              fcmToken: owner.fcm_token ?? null,
              productId: p.product_id,
              productName: p.product_name,
              remainingQty: remaining,
            });

            await prisma.clothingProduct.update({
              where: { product_id: p.product_id },
              data: { last_low_stock_notified_at: now },
            });
          }
        }
      }

      console.log("✅ Low stock cron completed");
    } catch (err) {
      console.error("❌ Low stock cron failed:", err.message);
    }
  },
  { timezone: "Asia/Kathmandu" }
);
