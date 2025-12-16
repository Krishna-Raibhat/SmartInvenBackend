const express = require("express");
const router = express.Router();

const supplierController = require("../controllers/hardwareSupplierController");
const authMiddleware = require("../middlewares/authMiddleware");

router.post("/", authMiddleware, supplierController.createSupplier);
router.get("/", authMiddleware, supplierController.getSuppliers);
router.get("/:id", authMiddleware, supplierController.getSupplierById);
router.put("/:id", authMiddleware, supplierController.updateSupplier);


module.exports = router;