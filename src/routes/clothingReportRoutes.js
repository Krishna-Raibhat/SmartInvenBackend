import express from "express";
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/clothingReportController.js";

const router = express.Router();

// Chart: sales vs cost vs paid (group by day/week/month/year)
router.get("/sales-cost-paid", auth, ctrl.salesCostPaid);

// Top products (qty or revenue)
router.get("/top-products", auth, ctrl.topProducts);

// Stock flow + profit (qty in/out + profit grouped)
router.get("/stock-flow", auth, ctrl.stockFlow);

router.get("/return-analytics", auth, ctrl.returnAnalytics);
// Download CSV (same data)
router.get("/download", auth, ctrl.download);

export default router;
