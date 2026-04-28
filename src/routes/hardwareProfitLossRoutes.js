import express from "express";
import ctrl from "../controllers/hardwareProfitLossController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

// Route to get profit/loss report
// Example: GET /api/hardware/profit-loss?type=monthly
router.get("/", authMiddleware, ctrl.getProfitLoss);

export default router;
