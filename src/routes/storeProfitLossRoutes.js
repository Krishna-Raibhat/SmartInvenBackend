// src/routes/storeProfitLossRoutes.js
import express from "express";
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/storeProfitLossController.js";

const router = express.Router();

// GET /api/store/profit-loss/summary?start=&end=
router.get("/summary", auth, ctrl.summary);

// GET /api/store/profit-loss/chart?start=&end=&group=day|week|month|year
router.get("/chart", auth, ctrl.salesChart);

// GET /api/store/profit-loss/top-products?start=&end=&limit=10
router.get("/top-products", auth, ctrl.topProducts);

// GET /api/store/profit-loss/returns?start=&end=
router.get("/returns", auth, ctrl.returnAnalytics);

export default router;
