// src/routes/hardwareStockInRoutes.js
import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/hardwareStockInController.js";

const router = express.Router();

router.post("/", authMiddleware, ctrl.stockIn);

export default router;
