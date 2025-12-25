const admin = require("../firebase/firebase-admin");

exports.sendLowStockNotification = async ({
  fcmToken,
  productName,
  remainingQty,
}) => {
  if (!fcmToken) return;
  console.log("📨 Sending FCM:", {
        productName,
        remainingQty,
        token: fcmToken.slice(0, 10) + "..."
  });

  const message = {
    token: fcmToken,
    notification: {
      title: "Low Stock Alert 🚨",
      body: `${productName} is low (${remainingQty} left)`,
    },
    data: {
      type: "LOW_STOCK",
      product: productName,
      qty: String(remainingQty),
    },
  };

  try {
    await admin.messaging().send(message);
    console.log("✅ FCM sent:", res);
  } catch (err) {
    console.error("FCM send error:", err.message);
  }
};
