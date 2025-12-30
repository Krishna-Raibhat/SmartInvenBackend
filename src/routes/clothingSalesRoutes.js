// src/routes/clothingSalesRoutes.js
const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/clothingSalesController");

router.post("/", auth, ctrl.create);
router.get("/", auth, ctrl.list);
router.get("/credits", auth, ctrl.creditList);
router.post("/:sales_id/pay", auth, ctrl.addPayment);
router.get("/:sales_id", auth, ctrl.getById);

// ✅ BILL
router.get("/:sales_id/bill", auth, ctrl.bill);

module.exports = router;
