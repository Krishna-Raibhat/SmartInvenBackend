// src/routes/clothingSupplierLotsRoutes.js
import express from "express";
const router = express.Router();
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/clothingSupplierLotsController.js";

// ✅ /api/clothing/suppliers/:supplier_id/lots
router.get("/:supplier_id/lots", auth, ctrl.listLots);

export default router;