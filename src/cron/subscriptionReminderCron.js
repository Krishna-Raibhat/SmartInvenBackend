import cron from "node-cron";
import { prisma } from "../prisma/client.js";
import { sendSubscriptionExpiryReminderEmail } from "../utils/mailer.js";

// Run daily at 9 AM
cron.schedule("0 9 * * *", async () => {
  console.log("[CRON] Checking for expiring subscriptions...");

  try {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const now = new Date();

    // Find active owners whose subscription expires in 7 days and haven't been reminded
    const expiringOwners = await prisma.owner.findMany({
      where: {
        status: "active",
        subscription_expires_at: {
          gte: now,
          lte: sevenDaysFromNow,
        },
        subscription_reminder_sent: false,
      },
      select: {
        owner_id: true,
        full_name: true,
        email: true,
        subscription_expires_at: true,
      },
    });

    console.log(`[CRON] Found ${expiringOwners.length} owners with expiring subscriptions`);

    for (const owner of expiringOwners) {
      try {
        await sendSubscriptionExpiryReminderEmail({
          to: owner.email,
          full_name: owner.full_name,
          expires_at: owner.subscription_expires_at,
        });

        await prisma.owner.update({
          where: { owner_id: owner.owner_id },
          data: { subscription_reminder_sent: true },
        });

        console.log(`[CRON] Sent reminder to ${owner.email}`);
      } catch (err) {
        console.error(`[CRON] Failed to send reminder to ${owner.email}:`, err.message);
      }
    }

    console.log("[CRON] Subscription reminder check completed");
  } catch (err) {
    console.error("[CRON] Subscription reminder cron error:", err);
  }
});

console.log("[CRON] Subscription reminder cron job scheduled (daily at 9 AM)");