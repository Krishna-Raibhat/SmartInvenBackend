// src/routes/clothingSupplierRoutes.js
const express = require("express");
const router = express.Router();

const auth = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/clothingSupplierController");

// /api/clothing/suppliers
router.post("/", auth, ctrl.create);
router.get("/", auth, ctrl.list);
router.get("/:supplier_id", auth, ctrl.getById);
router.put("/:supplier_id", auth, ctrl.update);
router.delete("/:supplier_id", auth, ctrl.remove);

module.exports = router;
