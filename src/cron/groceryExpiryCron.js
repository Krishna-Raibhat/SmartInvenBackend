import cron from "node-cron";
import prisma from "../config/prisma.js";
import { sendGroceryExpiryNotification } from "../services/groceryNotificationService.js";

const EXPIRY_WARNING_DAYS = 7; // Notify 7 days before expiry

cron.schedule(
  "0 9 * * *", // Run daily at 9:00 AM
  async () => {
    console.log("🔁 Running grocery expiry notification cron");

    try {
      const owners = await prisma.owner.findMany({
        select: { owner_id: true, fcm_token: true },
      });

      const now = new Date();
      const warningDate = new Date();
      warningDate.setDate(warningDate.getDate() + EXPIRY_WARNING_DAYS);

      for (const owner of owners) {
        const ownerId = owner.owner_id;

        // Find lots expiring within 7 days that still have stock
        const expiringLots = await prisma.groceryStockLot.findMany({
          where: {
            owner_id: ownerId,
            expiry_date: {
              gte: now, // Not yet expired
              lte: warningDate, // Expires within 7 days
            },
            qty_remaining: {
              gt: 0, // Still has stock
            },
          },
          include: {
            product: {
              select: {
                product_id: true,
                product_name: true,
              },
            },
          },
          orderBy: {
            expiry_date: 'asc', // Earliest expiry first
          },
        });

        for (const lot of expiringLots) {
          const daysUntilExpiry = Math.ceil(
            (new Date(lot.expiry_date) - now) / (1000 * 60 * 60 * 24)
          );

          await sendGroceryExpiryNotification({
            owner_id: ownerId,
            fcmToken: owner.fcm_token ?? null,
            lotId: lot.lot_id,
            productId: lot.product.product_id,
            productName: lot.product.product_name,
            batchNo: lot.batch_no,
            expiryDate: lot.expiry_date,
            daysUntilExpiry,
          });

          console.log(
            `✅ Expiry notification sent: ${lot.product.product_name} (Batch: ${lot.batch_no || 'N/A'}) - ${daysUntilExpiry} days`
          );
        }
      }

      console.log("✅ Grocery expiry cron completed");
    } catch (err) {
      console.error("❌ Grocery expiry cron failed:", err.message);
    }
  },
  { timezone: "Asia/Kathmandu" }
);

console.log("📅 Grocery expiry notification cron scheduled (daily at 9:00 AM)");
