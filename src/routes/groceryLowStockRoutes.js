import express from "express";
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/groceryLowStockController.js";

const router = express.Router();

router.get("/", auth, ctrl.lowStock); // ✅ /api/grocery/low-stock

export default router;
