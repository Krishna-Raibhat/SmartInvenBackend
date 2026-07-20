import "dotenv/config";
import "./cron/lowStockCronAll.js";
import "./cron/subscriptionReminderCron.js";
import "./cron/subscriptionExpiryCron.js";
import "./cron/groceryExpiryCron.js";
import "./cron/storeCustomerReminderCron.js";

console.log("⚡ Background Cron Worker started successfully!");
