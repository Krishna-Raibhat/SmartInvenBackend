import express from "express";
import * as supplierController from "../controllers/hardwareSupplierController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", authMiddleware, supplierController.createSupplier);
router.get("/", authMiddleware, supplierController.getSuppliers);
router.get("/:supplier_id", authMiddleware, supplierController.getSupplierById);
router.put("/:supplier_id", authMiddleware, supplierController.updateSupplier);
router.delete("/:supplier_id", authMiddleware, supplierController.deleteSupplier);

export default router;
