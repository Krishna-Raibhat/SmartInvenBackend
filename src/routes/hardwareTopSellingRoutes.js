import express from "express";
import * as ctrl from "../controllers/hardwareTopSellingController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/",authMiddleware,ctrl.getTopSellingProducts);

export default router;
