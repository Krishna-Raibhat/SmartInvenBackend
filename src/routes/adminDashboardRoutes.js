import { Router } from "express";
import * as adminDashboardController from "../controllers/adminDashboardController.js";

const router = Router();

// Admin dashboard routes (no auth for now, consistent with other admin endpoints)
router.get("/", adminDashboardController.getDashboard);
router.get("/stats", adminDashboardController.getStats);

export default router;
