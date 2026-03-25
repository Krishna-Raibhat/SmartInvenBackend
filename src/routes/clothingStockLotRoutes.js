const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/clothingStockLotController");

// bulk stock-in
router.post("/bulk", auth, ctrl.bulkCreate);

// get all lots for authenticated owner
router.get("/", auth, ctrl.getAll);

// get lot by barcode scan
router.get("/scan/:barcode", auth, ctrl.getByBarcode);

module.exports = router;
