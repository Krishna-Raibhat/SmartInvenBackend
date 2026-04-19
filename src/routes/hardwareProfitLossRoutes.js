import express from "express";

const router = express.Router();

import * as ctrl from "../controllers/hardwareProfitLossController.js";

import authMiddleware from "../middlewares/authMiddleware.js";

// Route to get profit/loss report
// Example: GET /api/hardware/profit-loss?type=monthly
//router.get("/type", authMiddleware, ctrl.getProfitLoss);
router.get("/", authMiddleware, ctrl.getProfitLoss);

export default router;
