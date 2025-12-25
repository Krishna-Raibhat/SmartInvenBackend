const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const prisma = require("../prisma/client");
const { sendLowStockNotification } = require("../services/notificationService");
const inventoryService = require("../services/hardwareInventoryService");

router.post("/test", auth, async (req, res) => {
  const owner_id = req.owner.owner_id;

  const owner = await prisma.owner.findUnique({
    where: { owner_id },
    select: { fcm_token: true },
  });

  if (!owner?.fcm_token) {
    return res.status(400).json({ success: false, message: "No fcm_token saved for this user" });
  }

  await sendLowStockNotification({
    fcmToken: owner.fcm_token,
    productName: "TEST PRODUCT",
    remainingQty: 5,
  });

  return res.json({ success: true, message: "Test notification sent" });
});

router.post("/run-low-stock-now", auth, async (req, res) => {
  const owner_id = req.owner.owner_id;
  const threshold = Number(req.body.threshold ?? 40);

  const owner = await prisma.owner.findUnique({
    where: { owner_id },
    select: { fcm_token: true },
  });

  if (!owner?.fcm_token) {
    return res.status(400).json({ success: false, message: "No fcm_token saved for this user" });
  }

  const low = await inventoryService.listLowStock(owner_id, threshold);

  for (const p of low) {
    await sendLowStockNotification({
      fcmToken: owner.fcm_token,
      productName: p.product_name,
      remainingQty: p.total_stock,
    });
  }

  return res.json({ success: true, message: "Low stock notifications processed", count: low.length });
});

module.exports = router;
