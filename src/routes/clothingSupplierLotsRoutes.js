// src/routes/clothingSupplierLotsRoutes.js
const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/clothingSupplierLotsController");

// ✅ /api/clothing/suppliers/:supplier_id/lots
router.get("/:supplier_id/lots", auth, ctrl.listLots);

module.exports = router;