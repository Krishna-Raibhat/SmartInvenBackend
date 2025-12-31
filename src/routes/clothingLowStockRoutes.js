const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/clothingLowStockController");

router.get("/", auth, ctrl.lowStock); // ✅ /api/clothing/low-stock

module.exports = router;
