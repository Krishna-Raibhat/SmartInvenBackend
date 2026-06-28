import express from "express";
import storeReportController from "../controllers/storeReportController.js";
import storeTopSellingController from "../controllers/storeTopSellingController.js";
import storePurchaseSummaryController from "../controllers/storePurchaseSummaryController.js";
import { getCurrentStock } from "../controllers/storeCurrentStockReportController.js";
import { getStockAlerts } from "../controllers/storeStockAlertController.js";
import storeProfitReportController from "../controllers/storeProfitReportController.js";
import auth from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/summary", auth, storeReportController.getSummary);
router.get("/sales-by-service", auth, storeReportController.salesByService);
router.get("/top-selling", auth, storeTopSellingController.getReport);
router.get("/purchase-summary", auth, storePurchaseSummaryController.getReport);
router.get("/current-stock", auth, getCurrentStock);
router.get("/stock-alerts", auth, getStockAlerts);
router.get("/profit", auth, storeProfitReportController.getReport);
router.get("/customer-dues", auth, storeReportController.customerDues);

export default router;