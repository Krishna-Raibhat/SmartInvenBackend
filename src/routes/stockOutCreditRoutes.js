import express from "express";`nconst router = express.Router();

import * as ctrl from "../controllers/stockOutCreditController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

router.get("/credit",authMiddleware,ctrl.getStockOutCredits);

export default router;