import express from "express";
const router = express.Router();

import authMiddleware from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/hardwareDashboardController.js";

router.get("/summary", authMiddleware, ctrl.summary);

export default router;
