import express from "express";
import storeReportController from "../controllers/storeReportController.js";
import storeTopSellingController from "../controllers/storeTopSellingController.js";
import storePurchaseSummaryController from "../controllers/storePurchaseSummaryController.js";
import auth from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/summary", auth, storeReportController.getSummary);
router.get("/top-selling", auth, storeTopSellingController.getReport);
router.get("/purchase-summary", auth, storePurchaseSummaryController.getReport);

export default router;