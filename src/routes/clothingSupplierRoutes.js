// src/routes/clothingSupplierRoutes.js
import express from "express";
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/clothingSupplierController.js";

const router = express.Router();

// /api/clothing/suppliers
router.post("/", auth, ctrl.create);
router.get("/", auth, ctrl.list);
router.get("/:supplier_id", auth, ctrl.getById);
router.put("/:supplier_id", auth, ctrl.update);
router.delete("/:supplier_id", auth, ctrl.remove);

export default router;
