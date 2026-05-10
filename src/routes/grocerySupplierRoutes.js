// src/routes/grocerySupplierRoutes.js
import express from "express";
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/grocerySupplierController.js";

const router = express.Router();

// /api/grocery/suppliers
router.post("/", auth, ctrl.create);
router.get("/", auth, ctrl.list);
router.get("/:supplier_id", auth, ctrl.getById);
router.put("/:supplier_id", auth, ctrl.update);
router.delete("/:supplier_id", auth, ctrl.remove);

export default router;
