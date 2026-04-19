// src/services/notificationService.js
import admin from "../firebase/firebase-admin.js";
import { prisma } from "../prisma/client.js";

export const sendLowStockNotification = async ({
  owner_id,
  fcmToken,
  productId,
  productName,
  remainingQty,
}) => {
  const title = "Low Stock Alert 🚨";
  const messageText = `${productName} is low (${remainingQty} left)`;

  /* ===============================
     ⛔ PREVENT DB SPAM (24h rule)
  =============================== */
  const existing = await prisma.hardwareNotification.findFirst({
    where: {
      owner_id,
      type: "LOW_STOCK",
      product_id: productId ?? null,
      created_at: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
  });

  if (existing) {
    return existing; // already notified in last 24h
  }

  /* ===============================
     📝 SAVE NOTIFICATION IN DB
  =============================== */
  const saved = await prisma.hardwareNotification.create({
    data: {
      owner_id,
      type: "LOW_STOCK",
      title,
      message: messageText,
      product_id: productId ?? null,
    },
  });

  /* ===============================
     🔕 NO TOKEN → DB ONLY
  =============================== */
  if (!fcmToken) return saved;

  /* ===============================
     🔔 SEND FCM PUSH
  =============================== */
  const message = {
    token: fcmToken,
    notification: {
      title,
      body: messageText,
    },
    data: {
      type: "LOW_STOCK",
      product_id: productId ?? "",
      product: productName,
      qty: String(remainingQty),
      notification_id: saved.notification_id,
    },
  };

  try {
    const resp = await admin.messaging().send(message);
    console.log("✅ FCM sent:", resp);
  } catch (err) {
    console.error("❌ FCM send error:", err.message);
  }

  return saved;
};
