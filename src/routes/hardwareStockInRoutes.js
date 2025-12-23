// src/routes/hardwareStockInRoutes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/hardwareStockInController");

router.post("/", authMiddleware, ctrl.stockIn);

module.exports = router;
