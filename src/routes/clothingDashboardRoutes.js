// src/routes/clothingDashboardRoutes.js
const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/clothingDashboardController");

router.get("/summary", auth, ctrl.summary);
// GET /api/clothing/dashboard/summary?start=2025-12-01&end=2025-12-31

module.exports = router;
