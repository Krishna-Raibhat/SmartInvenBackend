import express from "express";
const router = express.Router();
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/clothingLowStockController.js";

router.get("/", auth, ctrl.lowStock); // ✅ /api/clothing/low-stock

export default router;
