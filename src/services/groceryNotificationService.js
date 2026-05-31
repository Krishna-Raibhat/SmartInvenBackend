import admin from "../firebase/firebase-admin.js";
import prisma from "../config/prisma.js";
import groceryNotificationPreferenceService from "./groceryNotificationPreferenceService.js";

export const sendGroceryLowStockNotification = async ({
  owner_id,
  fcmToken,
  productId,
  productName,
  remainingQty,
  unitName,
}) => {
  // ✅ Check if user has enabled low_stock notifications
  const shouldSend = await groceryNotificationPreferenceService.shouldSendNotification(
    owner_id,
    "low_stock"
  );

  if (!shouldSend) {
    console.log(`⏭️  Low stock notification skipped for owner ${owner_id} (disabled)`);
    return null;
  }

  const title = "Low Stock Alert 🚨";
  const messageText = `${productName} is low (${remainingQty} ${unitName} left)`;

  const existing = await prisma.groceryNotification.findFirst({
    where: {
      owner_id,
      type: "LOW_STOCK",
      product_id: productId,
      created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  if (existing) return existing;

  const saved = await prisma.groceryNotification.create({
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
      module: "grocery",
      product_id: productId,
      qty: String(remainingQty),
      unit: unitName,
      notification_id: saved.notification_id,
    },
  };

  try {
    await admin.messaging().send(message);
  } catch (err) {
    console.error("❌ Grocery FCM error:", err.message);
  }

  return saved;
};

export const sendGroceryExpiryNotification = async ({
  owner_id,
  fcmToken,
  lotId,
  productId,
  productName,
  batchNo,
  expiryDate,
  daysUntilExpiry,
}) => {
  // ✅ Check if user has enabled expiry notifications
  const shouldSend = await groceryNotificationPreferenceService.shouldSendNotification(
    owner_id,
    "expiry"
  );

  if (!shouldSend) {
    console.log(`⏭️  Expiry notification skipped for owner ${owner_id} (disabled)`);
    return null;
  }

  const title = "Product Expiring Soon ⚠️";
  const expiryDateStr = new Date(expiryDate).toLocaleDateString();
  const messageText = `${productName}${batchNo ? ` (Batch: ${batchNo})` : ''} expires in ${daysUntilExpiry} days (${expiryDateStr})`;

  // Check if notification already sent for this lot in last 24 hours
  const existing = await prisma.groceryNotification.findFirst({
    where: {
      owner_id,
      type: "EXPIRY_WARNING",
      product_id: productId,
      message: { contains: batchNo || productName },
      created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  if (existing) return existing;

  const saved = await prisma.groceryNotification.create({
    data: {
      owner_id,
      type: "EXPIRY_WARNING",
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
      type: "EXPIRY_WARNING",
      module: "grocery",
      lot_id: lotId,
      product_id: productId,
      batch_no: batchNo || "",
      expiry_date: expiryDate.toISOString(),
      days_until_expiry: String(daysUntilExpiry),
      notification_id: saved.notification_id,
    },
  };

  try {
    await admin.messaging().send(message);
  } catch (err) {
    console.error("❌ Grocery Expiry FCM error:", err.message);
  }

  return saved;
};
