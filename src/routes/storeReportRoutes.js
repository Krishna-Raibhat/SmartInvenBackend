import express from "express";
import storeReportController from "../controllers/storeReportController.js";
import auth from "../middlewares/authMiddleware.js"; // adjust path if different

const router = express.Router();

router.get("/summary", auth , storeReportController.getSummary);

export default router;