// src/routes/clothingSalesRoutes.js
const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/clothingSalesController");

router.post("/", auth, ctrl.create);
router.get("/", auth, ctrl.list);
router.get("/credit", auth, ctrl.creditList);
router.get("/:sales_id", auth, ctrl.getById);
router.post("/:sales_id/payments", auth, ctrl.addPayment);
router.get("/:sales_id/bill", auth, ctrl.bill);
router.get("/:sales_id/bill/pdf", auth, ctrl.billPdf);

module.exports = router;
