const express = require("express");
const router = express.Router();

const ctrl=require("../controllers/StockInOutReportController");
const authMiddleware = require("../middlewares/authMiddleware");

router.get("/stock-in-fixed",authMiddleware,ctrl.stockInFixed);
router.get("/stock-out-fixed",authMiddleware,ctrl.stockOutFixed);
router.get("/combined-fixed",authMiddleware,ctrl.combinedFixed);

router.get("/stock-in",authMiddleware,ctrl.stockIn);
router.get("/stock-out",authMiddleware,ctrl.stockOut);
router.get("/combined",authMiddleware,ctrl.combined);

module.exports = router;