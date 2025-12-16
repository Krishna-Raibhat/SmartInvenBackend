const express = require("express");
const router = express.Router();

const supplierController = require("../controllers/hardwareSupplierController");
const authMiddleware = require("../middlewares/authMiddleware");

router.get("/", authMiddleware, supplierController.getSuppliers);
router.post("/addSupplier", authMiddleware, supplierController.createSupplier);
router.get("/getSupplier", authMiddleware, supplierController.getSupplierById);
router.put("/updateSupplier", authMiddleware, supplierController.updateSupplier);


module.exports = router;