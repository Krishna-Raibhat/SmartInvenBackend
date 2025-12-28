const cron = require("node-cron");
const prisma = require("../prisma/client");
const { sendLowStockNotification } = require("../services/notificationService");

const LOW_STOCK_THRESHOLD = 40;

cron.schedule(
  "* * * * *", // every minute (safe now)
  async () => {
    try {
      console.log("🔔 Running low stock cron");

      const owners = await prisma.owner.findMany({
        select: { owner_id: true, fcm_token: true },
      });

      for (const owner of owners) {
        

        // total stock per product
        const sums = await prisma.hardwareStockLot.groupBy({
          by: ["product_id"],
          where: { owner_id: owner.owner_id },
          _sum: { qty_remaining: true },
        });

        if (!sums.length) continue;

        const stockMap = new Map(
          sums.map(x => [x.product_id, Number(x._sum.qty_remaining || 0)])
        );

        const products = await prisma.hardwareProduct.findMany({
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

          /* ===============================
             ✅ RESET WHEN STOCK IS NORMAL
          =============================== */
          if (
            remainingQty >= LOW_STOCK_THRESHOLD &&
            p.last_low_stock_notified_at
          ) {
            await prisma.hardwareProduct.update({
              where: { product_id: p.product_id },
              data: { last_low_stock_notified_at: null },
            });
            continue; // do NOT notify
          }

          // skip if not low stock
          if (remainingQty >= LOW_STOCK_THRESHOLD) continue;

          /* ===============================
             ⏱️ PREVENT SPAM (24h rule)
          =============================== */
          const last = p.last_low_stock_notified_at;
          const hoursSinceLast =
            last
              ? (now.getTime() - new Date(last).getTime()) / (1000 * 60 * 60)
              : Infinity;

          if (hoursSinceLast < 24) continue;

          /* ===============================
             🔔 SEND NOTIFICATION
          =============================== */
          await sendLowStockNotification({
            owner_id: owner.owner_id,
            fcmToken: owner.fcm_token?? null,
            productId: p.product_id,
            productName: p.product_name,
            remainingQty,
          });

          /* ===============================
             📝 MARK AS NOTIFIED
          =============================== */
          await prisma.hardwareProduct.update({
            where: { product_id: p.product_id },
            data: { last_low_stock_notified_at: now },
          });
        }
      }
    } catch (err) {
      console.error("❌ Low stock cron error:", err.message);
    }
  },
  {
    timezone: "Asia/Kathmandu", // 🇳🇵 Nepal time
  }
);
