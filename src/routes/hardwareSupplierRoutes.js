const express = require("express");
const router = express.Router();

const supplierController = require("../controllers/hardwareSupplierController");
const authMiddleware = require("../middlewares/authMiddleware");


router.get("/", authMiddleware, supplierController.getSuppliers);
router.post("/addSupplier", authMiddleware, supplierController.createSupplier);
router.get("/getSupplier/:supplier_id", authMiddleware, supplierController.getSupplierById);
router.put("/updateSupplier", authMiddleware, supplierController.updateSupplier);
router.delete("/deleteSupplier/:supplier_id", authMiddleware, supplierController.deleteSupplier);

module.exports = router;