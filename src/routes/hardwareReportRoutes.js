const express = require("express");
const router = express.Router();

const ctrl=require("../controllers/StockInOutReportController");
const authMiddleware = require("../middlewares/authMiddleware");

router.get("/stock-in",authMiddleware,ctrl.stockIn);
router.get("/stock-out",authMiddleware,ctrl.stockOut);
router.get("/combined",authMiddleware,ctrl.combined);

module.exports = router;