import express from "express";
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/clothingLowStockController.js";

const router = express.Router();

router.get("/", auth, ctrl.lowStock); // ✅ /api/clothing/low-stock

export default router;
