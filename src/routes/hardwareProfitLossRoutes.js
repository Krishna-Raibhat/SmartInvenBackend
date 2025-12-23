const express = require("express");

const router = express.Router();

const ctrl = require("../controllers/hardwareProfitLossController");

const authMiddleware = require("../middlewares/authMiddleware");

// Route to get profit/loss report
// Example: GET /api/hardware/profit-loss?period=monthly
router.get("/", authMiddleware, ctrl.getProfitLoss);

module.exports = router;
