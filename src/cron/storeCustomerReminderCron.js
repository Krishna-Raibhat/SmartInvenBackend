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

      console.log(
        `[CRON] Found ${pendingReminders.length} pending store customer reminders.`,
      );

      for (const reminder of pendingReminders) {
        try {
          // Atomically claim this reminder.
          // Only ONE cron/process can change false -> true.
          const claimed = await prisma.storeCustomerReminder.updateMany({
            where: {
              reminder_id: reminder.reminder_id,
              is_notified: false,
            },
            data: {
              is_notified: true,
            },
          });

          // Another cron/process already claimed it.
          if (claimed.count === 0) {
            console.log(
              `[CRON] Reminder ${reminder.reminder_id} already processed.`,
            );
            continue;
          }

          try {
            await sendStoreCustomerReminderNotification({
              owner_id: reminder.owner_id,
              fcmToken: reminder.owner.fcm_token,
              itemName: reminder.item_name,
              notes: reminder.notes,
            });

            console.log(
              `[CRON] Notified customer reminder: ${reminder.item_name} for owner ${reminder.owner_id}`,
            );
          } catch (sendError) {
            // Allow retry next minute if sending itself failed.
            await prisma.storeCustomerReminder.updateMany({
              where: {
                reminder_id: reminder.reminder_id,
                is_notified: true,
              },
              data: {
                is_notified: false,
              },
            });

            throw sendError;
          }
        } catch (err) {
          console.error(
            `[CRON] Failed to notify reminder ${reminder.reminder_id}:`,
            err.message,
          );
        }
      }
    } catch (err) {
      console.error("[CRON] Customer reminder cron error:", err.message);
    }
  },
  {
    timezone: "Asia/Kathmandu",
  },
);
console.log("[CRON] Store customer reminder cron job scheduled (every minute)");
