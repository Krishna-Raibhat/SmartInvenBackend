// src/routes/storeDashboardRoutes.js
import express from "express";
import auth from "../middlewares/authMiddleware.js";
import { getDashboard, getRecentActivities , getInventoryValue} from "../controllers/storeDashboardController.js";

const router = express.Router();

router.get("/", auth, getDashboard);
router.get("/activities", auth, getRecentActivities);
router.get("/inventory-value", auth, getInventoryValue); 
export default router;
