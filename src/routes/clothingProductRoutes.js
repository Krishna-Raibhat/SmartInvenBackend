// src/routes/clothingProductRoutes.js
const express = require("express");
const router = express.Router();

const auth = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/clothingProductController");

// /api/clothing/products
router.post("/", auth, ctrl.create);
router.get("/", auth, ctrl.list);
router.get("/:product_id", auth, ctrl.getById);
router.put("/:product_id", auth, ctrl.update);
router.delete("/:product_id", auth, ctrl.remove);

module.exports = router;
