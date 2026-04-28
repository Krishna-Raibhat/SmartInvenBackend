// src/routes/clothingSupplierLotsRoutes.js
import express from "express";
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/clothingSupplierLotsController.js";

const router = express.Router();

// ✅ /api/clothing/suppliers/:supplier_id/lots
router.get("/:supplier_id/lots", auth, ctrl.listLots);

export default router;
