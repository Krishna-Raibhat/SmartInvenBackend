// src/routes/hardwareStockOutRoutes.js
import express from "express";
const router = express.Router();

import authMiddleware from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/hardwareStockOutController.js";

router.post("/", authMiddleware, ctrl.createStockOut);
router.get("/", authMiddleware, ctrl.listStockOut);
router.get("/:stockout_id", authMiddleware, ctrl.getStockOutById);
router.post("/:stockout_id/payments", authMiddleware, ctrl.addPayment);

export default router;
