import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/hardwareDashboardController.js";

const router = express.Router();

router.get("/summary", authMiddleware, ctrl.summary);

export default router;
