// src/routes/storeDashboardRoutes.js
import express from "express";
import auth from "../middlewares/authMiddleware.js";
import { getDashboard, getRecentActivities , getInventoryValue, getLowStockItems } from "../controllers/storeDashboardController.js";

const router = express.Router();

router.get("/", auth, getDashboard);
router.get("/activities", auth, getRecentActivities);
router.get("/inventory-value", auth, getInventoryValue); 
router.get("/low-stock", auth, getLowStockItems);
export default router;
