import admin from "../firebase/firebase-admin.js";
import prisma from "../config/prisma.js";

export const sendGroceryLowStockNotification = async ({
  owner_id,
  fcmToken,
  productId,
  productName,
  remainingQty,
  unitName,
}) => {
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
