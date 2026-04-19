// src/routes/clothingDashboardRoutes.js
import express from "express";
const router = express.Router();
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/clothingDashboardController.js";

router.get("/summary", auth, ctrl.summary);
// GET /api/clothing/dashboard/summary?start=2025-12-01&end=2025-12-31

export default router;
