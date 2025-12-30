const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/clothingStockLotController");

// bulk stock-in
router.post("/bulk", auth, ctrl.bulkCreate);

module.exports = router;
