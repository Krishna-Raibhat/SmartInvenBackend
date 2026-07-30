import cron from "node-cron";
import { prisma } from "../prisma/client.js";
import { sendTrialExpiryReminderEmail } from "../utils/mailer.js";

// Run daily at 9 AM
cron.schedule("0 9 * * *", async () => {
  console.log("[CRON] Checking for expiring trials...");

  try {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const now = new Date();

    // Find trial owners whose trial expires in 7 days and haven't been reminded
    const expiringTrials = await prisma.owner.findMany({
      where: {
        status: "trial",
        trial_expires_at: {
          gte: now,
          lte: sevenDaysFromNow,
        },
        trial_reminder_sent: false,
      },
      select: {
        owner_id: true,
        full_name: true,
        email: true,
        trial_expires_at: true,
      },
    });

    console.log(`[CRON] Found ${expiringTrials.length} owners with expiring trials`);

    for (const owner of expiringTrials) {
      try {
        await sendTrialExpiryReminderEmail({
          to: owner.email,
          full_name: owner.full_name,
          expires_at: owner.trial_expires_at,
        });

        await prisma.owner.update({
          where: { owner_id: owner.owner_id },
          data: { trial_reminder_sent: true },
        });

        console.log(`[CRON] Sent trial reminder to ${owner.email}`);
      } catch (err) {
        console.error(`[CRON] Failed to send trial reminder to ${owner.email}:`, err.message);
      }
    }

    console.log("[CRON] Trial reminder check completed");
  } catch (err) {
    console.error("[CRON] Trial reminder cron error:", err);
  }
});

console.log("[CRON] Trial reminder cron job scheduled (daily at 9 AM)");