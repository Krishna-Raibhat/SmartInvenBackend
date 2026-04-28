import cron from "node-cron";
import { prisma } from "../prisma/client.js";

// Run daily at midnight
cron.schedule("0 0 * * *", async () => {
  console.log("[CRON] Checking for expired subscriptions...");

  try {
    const now = new Date();

    const result = await prisma.owner.updateMany({
      where: {
        status: "active",
        subscription_expires_at: {
          lt: now,
        },
      },
      data: {
        status: "inactive",
        subscription_reminder_sent: false,
      },
    });

    console.log(`[CRON] Marked ${result.count} owner(s) as inactive due to expired subscription.`);
  } catch (err) {
    console.error("[CRON] Subscription expiry cron error:", err);
  }
});

console.log("[CRON] Subscription expiry cron job scheduled (daily at midnight)");
