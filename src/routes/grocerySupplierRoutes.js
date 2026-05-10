// src/routes/grocerySupplierRoutes.js
import { Router } from "express";
import * as grocerySupplierController from "../controllers/grocerySupplierController.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /api/grocery/suppliers - Create supplier
router.post("/", grocerySupplierController.create);

// GET /api/grocery/suppliers - List all suppliers
router.get("/", grocerySupplierController.list);

// GET /api/grocery/suppliers/:supplier_id - Get supplier by ID
router.get("/:supplier_id", grocerySupplierController.getById);

// PUT /api/grocery/suppliers/:supplier_id - Update supplier
router.put("/:supplier_id", grocerySupplierController.update);

// DELETE /api/grocery/suppliers/:supplier_id - Delete supplier
router.delete("/:supplier_id", grocerySupplierController.remove);

export default router;
