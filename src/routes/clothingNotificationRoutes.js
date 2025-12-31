// src/routes/clothingNotificationRoutes.js
const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/clothingNotificationController");

router.get("/", auth, ctrl.list);
router.post("/:id/read", auth, ctrl.markRead);
router.post("/read-all", auth, ctrl.markAllRead);

module.exports = router;
