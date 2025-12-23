const express = require("express");
const router = express.Router();

const supplierController = require("../controllers/hardwareSupplierController");
const authMiddleware = require("../middlewares/authMiddleware");


router.post("/", authMiddleware, supplierController.createSupplier);
router.get("/", authMiddleware, supplierController.getSuppliers);
router.get("/:supplier_id", authMiddleware, supplierController.getSupplierById);
router.put("/:supplier_id", authMiddleware, supplierController.updateSupplier);
router.delete("/:supplier_id", authMiddleware, supplierController.deleteSupplier);

module.exports = router;