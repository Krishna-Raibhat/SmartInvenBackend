const admin = require("../firebase/firebase-admin");
const { prisma } = require("../prisma/client");

exports.sendClothingLowStockNotification = async ({
  owner_id,
  fcmToken,
  productId,
  productName,
  remainingQty,
}) => {
  const title = "Low Stock Alert 🚨";
  const messageText = `${productName} is low (${remainingQty} left)`;

  const existing = await prisma.clothingNotification.findFirst({
    where: {
      owner_id,
      type: "LOW_STOCK",
      product_id: productId,
      created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  if (existing) return existing;

  const saved = await prisma.clothingNotification.create({
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
      module: "clothing",
      product_id: productId,
      qty: String(remainingQty),
      notification_id: saved.notification_id,
    },
  };

  try {
    await admin.messaging().send(message);
  } catch (err) {
    console.error("❌ Clothing FCM error:", err.message);
  }

  return saved;
};
