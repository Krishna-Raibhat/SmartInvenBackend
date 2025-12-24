const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/hardwareTopSellingController");
const authMiddleware = require("../middlewares/authMiddleware");

router.get("/",authMiddleware,ctrl.getTopSellingProducts);

module.exports = router;
