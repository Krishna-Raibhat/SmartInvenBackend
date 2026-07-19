import cron from "node-cron";
import { prisma } from "../prisma/client.js";
import { sendStoreCustomerReminderNotification } from "../services/storeNotificationService.js";

cron.schedule(
  "* * * * *", // every minute
  async () => {
    try {
      const now = new Date();

      // Find reminders that are due and not notified yet
      const pendingReminders = await prisma.storeCustomerReminder.findMany({
        where: {
          reminder_date: { lte: now },
          is_notified: false,
        },
        include: {
          owner: true,
        },
      });

      if (pendingReminders.length === 0) return;

      console.log(`[CRON] Found ${pendingReminders.length} pending store customer reminders.`);

      for (const reminder of pendingReminders) {
        try {
          // Send notification and save notification in DB
          await sendStoreCustomerReminderNotification({
            owner_id: reminder.owner_id,
            fcmToken: reminder.owner.fcm_token,
            itemName: reminder.item_name,
            notes: reminder.notes,
          });

          // Mark as notified
          await prisma.storeCustomerReminder.update({
            where: { reminder_id: reminder.reminder_id },
            data: { is_notified: true },
          });

          console.log(`[CRON] Notified customer reminder: ${reminder.item_name} for owner ${reminder.owner_id}`);
        } catch (err) {
          console.error(`[CRON] Failed to notify reminder ${reminder.reminder_id}:`, err.message);
        }
      }
    } catch (err) {
      console.error("[CRON] Customer reminder cron error:", err.message);
    }
  },
  {
    timezone: "Asia/Kathmandu",
  }
);
console.log("[CRON] Store customer reminder cron job scheduled (every minute)");
