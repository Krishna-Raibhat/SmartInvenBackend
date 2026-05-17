import express from "express";
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/groceryReportController.js";

const router = express.Router();

router.get("/sales-summary", auth, ctrl.salesSummary); // ✅ /api/grocery/reports/sales-summary
router.get("/top-products", auth, ctrl.topProducts); // ✅ /api/grocery/reports/top-products
router.get("/stock-flow", auth, ctrl.stockFlow); // ✅ /api/grocery/reports/stock-flow
router.get("/return-analytics", auth, ctrl.returnAnalytics); // ✅ /api/grocery/reports/return-analytics

export default router;
