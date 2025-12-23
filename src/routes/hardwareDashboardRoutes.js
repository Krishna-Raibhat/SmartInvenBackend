const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/hardwareDashboardController");

router.get("/summary", authMiddleware, ctrl.summary);

module.exports = router;
