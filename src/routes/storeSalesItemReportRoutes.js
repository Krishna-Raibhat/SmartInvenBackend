import express from "express";
import storeSalesItemReportController from "../controllers/storeSalesItemReportController.js";
import auth from "../middlewares/authMiddleware.js";

const router = express.Router();

// GET /api/store/reports/sales-by-item?from=2025-06-01&to=2025-06-30
router.get("/sales-by-item", auth, storeSalesItemReportController.salesByItem);

export default router;