// src/routes/clothingSupplierRoutes.js
import express from "express";
const router = express.Router();

import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/clothingSupplierController.js";

// /api/clothing/suppliers
router.post("/", auth, ctrl.create);
router.get("/", auth, ctrl.list);
router.get("/:supplier_id", auth, ctrl.getById);
router.put("/:supplier_id", auth, ctrl.update);
router.delete("/:supplier_id", auth, ctrl.remove);

export default router;
