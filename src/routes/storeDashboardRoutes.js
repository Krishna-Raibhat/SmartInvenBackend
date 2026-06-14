// src/routes/storeDashboardRoutes.js
import express from "express";
import auth from "../middlewares/authMiddleware.js";
import { getDashboard, getRecentActivities } from "../controllers/storeDashboardController.js";

const router = express.Router();

router.get("/", auth, getDashboard);
router.get("/activities", auth, getRecentActivities);

export default router;
