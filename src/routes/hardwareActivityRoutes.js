// src/routes/hardwareActivityRoutes.js
import { Router } from "express";
import * as ctrl from "../controllers/hardwareActivityController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/", authMiddleware, ctrl.getRecentActivities);

export default router;
