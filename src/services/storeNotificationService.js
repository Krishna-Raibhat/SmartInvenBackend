// src/services/storeNotificationService.js
import admin from "../firebase/firebase-admin.js";
import { prisma } from "../prisma/client.js";
import storeNotificationPreferenceService from "./storeNotificationPreferenceService.js";

export const sendStoreLowStockNotification = async ({
  owner_id,
  fcmToken,
  productId,
  productName,
  remainingQty,
  unitName,
}) => {
  // Check if owner has low_stock notifications enabled
  const shouldSend = await storeNotificationPreferenceService.shouldSendNotification(
    owner_id,
    "low_stock"
  );

  if (!shouldSend) {
    console.log(`⏭️  Store low stock notification skipped for owner ${owner_id} (disabled)`);
    return null;
  }

  const title = "Low Stock Alert 🚨";
  const messageText = unitName
    ? `${productName} is low (${remainingQty} ${unitName} left)`
    : `${productName} is low (${remainingQty} left)`;

  // Deduplication — skip if already sent in the last 24h
  const existing = await prisma.storeNotification.findFirst({
    where: {
      owner_id,
      type: "LOW_STOCK",
      product_id: productId,
      created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  if (existing) return existing;

  const saved = await prisma.storeNotification.create({
    data: {
      owner_id,
      type: "LOW_STOCK",
      title,
      message: messageText,
      product_id: productId,
    },
  });

  if (!fcmToken) return saved;

  const message = {
    token: fcmToken,
    notification: { title, body: messageText },
    data: {
      type: "LOW_STOCK",
      module: "store",
      product_id: productId,
      qty: String(remainingQty),
      unit: unitName || "",
      notification_id: saved.notification_id,
    },
  };

  try {
    await admin.messaging().send(message);
  } catch (err) {
    console.error("❌ Store FCM error:", err.message);
  }

  return saved;
};

export const sendStoreCustomerReminderNotification = async ({
  owner_id,
  fcmToken,
  itemName,
  notes,
}) => {
  const title = "Customer Reminder 🔔";
  const messageText = `You noted: ${itemName}${notes ? ` (${notes})` : ""}`;

  // Save to DB under store_notifications
  const saved = await prisma.storeNotification.create({
    data: {
      owner_id,
      type: "CUSTOMER_REMINDER",
      title,
      message: messageText,
    },
  });

  if (!fcmToken) return saved;

  const message = {
    token: fcmToken,
    notification: {
      title,
      body: messageText,
    },
    data: {
      type: "CUSTOMER_REMINDER",
      module: "store",
      item_name: itemName,
      notes: notes || "",
      notification_id: saved.notification_id,
    },
  };

  try {
    await admin.messaging().send(message);
    console.log(`✅ FCM reminder sent to owner ${owner_id} for ${itemName}`);
  } catch (err) {
    console.error("❌ Store FCM reminder error:", err.message);
  }

  return saved;
};
