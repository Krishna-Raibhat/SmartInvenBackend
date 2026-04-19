import express from "express";
const router = express.Router();

import * as ctrl from "../controllers/hardwareTopSellingController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

router.get("/",authMiddleware,ctrl.getTopSellingProducts);

export default router;
