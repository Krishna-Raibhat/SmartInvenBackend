// src/routes/storeSaleDaybookRoutes.js
import { Router } from "express";
import * as ctrl from "../controllers/Storesaledaybookcontroller.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = Router();

// GET /api/store/daybook?date=YYYY-MM-DD (date optional, defaults to today)
router.get("/", authMiddleware, ctrl.getDaybook);

export default router;