import express from "express";
import * as ctrl from "../controllers/stockOutCreditController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/credit",authMiddleware,ctrl.getStockOutCredits);

export default router;
