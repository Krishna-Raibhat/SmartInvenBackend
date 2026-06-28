// src/routes/storeSalesSummaryReportRoutes.js
import express from "express";
import { getSalesSummary } from "../controllers/storeSalesSummaryReportController.js";
import auth from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/salesreport-summary", auth, getSalesSummary);

export default router;