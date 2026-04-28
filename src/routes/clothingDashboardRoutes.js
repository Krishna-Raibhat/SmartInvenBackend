// src/routes/clothingDashboardRoutes.js
import express from "express";
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/clothingDashboardController.js";

const router = express.Router();

router.get("/summary", auth, ctrl.summary);
// GET /api/clothing/dashboard/summary?start=2025-12-01&end=2025-12-31

export default router;
