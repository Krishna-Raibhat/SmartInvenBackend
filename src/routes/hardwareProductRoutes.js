// src/routes/hardwareProductRoutes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/hardwareProductController");

router.post("/", authMiddleware, ctrl.createProduct);
router.get("/", authMiddleware, ctrl.listProducts);
router.get("/:product_id", authMiddleware, ctrl.getProduct);
router.put("/:product_id", authMiddleware, ctrl.updateProduct);
router.delete("/:product_id", authMiddleware, ctrl.deleteProduct);

module.exports = router;
