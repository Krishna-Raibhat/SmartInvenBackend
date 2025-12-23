// src/routes/hardwareStockOutRoutes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/hardwareStockOutController");

router.post("/", authMiddleware, ctrl.createStockOut);
router.get("/", authMiddleware, ctrl.listStockOut);
router.get("/:stockout_id", authMiddleware, ctrl.getStockOutById);

module.exports = router;
