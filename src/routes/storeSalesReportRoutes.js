import express from "express";
import storeSalesReportController from "../controllers/storeSalesReportController.js";
import auth from "../middlewares/authMiddleware.js";

const router = express.Router();

// GET /api/store/reports/sales-by-service?from=2025-05-01&to=2025-05-31
router.get(
  "/sales-by-service",
  auth,
  storeSalesReportController.salesByService
);

export default router;