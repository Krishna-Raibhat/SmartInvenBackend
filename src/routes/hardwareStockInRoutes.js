// src/routes/hardwareStockInRoutes.js
import express from "express";
const router = express.Router();

import authMiddleware from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/hardwareStockInController.js";

router.post("/", authMiddleware, ctrl.stockIn);

export default router;
