// src/routes/storeDashboardRoutes.js

import express from "express";
import auth from "../middlewares/authMiddleware.js";

import {
  getDashboardSummary,
  getSalesChart,
  getRecentActivities,
  getInventoryValue,
  getLowStockItems,
} from "../controllers/storeDashboardController.js";

const router = express.Router();

router.get(
  "/summary",
  auth,
  getDashboardSummary,
);

router.get(
  "/sales-chart",
  auth,
  getSalesChart,
);

router.get(
  "/activities",
  auth,
  getRecentActivities,
);

router.get(
  "/inventory-value",
  auth,
  getInventoryValue,
);

router.get(
  "/low-stock",
  auth,
  getLowStockItems,
);

export default router;