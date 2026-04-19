import express from "express";
const router = express.Router();

import ctrl from "../controllers/StockInOutReportController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

router.get("/stock-in-fixed",authMiddleware,ctrl.stockInFixed);
router.get("/stock-out-fixed",authMiddleware,ctrl.stockOutFixed);
router.get("/combined-fixed",authMiddleware,ctrl.combinedFixed);

router.get("/stock-in",authMiddleware,ctrl.stockIn);
router.get("/stock-out",authMiddleware,ctrl.stockOut);
router.get("/combined",authMiddleware,ctrl.combined);

export default router;