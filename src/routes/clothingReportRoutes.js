const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/clothingReportController");

// Chart: sales vs cost vs paid (group by day/week/month/year)
router.get("/sales-cost-paid", auth, ctrl.salesCostPaid);

// Top products (qty or revenue)
router.get("/top-products", auth, ctrl.topProducts);

// Stock flow + profit (qty in/out + profit grouped)
router.get("/stock-flow", auth, ctrl.stockFlow);

// Download CSV (same data)
router.get("/download", auth, ctrl.download);

module.exports = router;
