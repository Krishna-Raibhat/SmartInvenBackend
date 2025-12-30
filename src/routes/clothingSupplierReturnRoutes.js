// src/routes/clothingSupplierReturnRoutes.js
const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/clothingSupplierReturnController");

router.post("/", auth, ctrl.create);
router.get("/", auth, ctrl.list);
router.get("/:return_id", auth, ctrl.getById);

router.post("/:return_id/status", auth, ctrl.updateStatus); // {status:"approved"}
router.post("/:return_id/cancel", auth, ctrl.cancel);
router.delete("/:return_id", auth, ctrl.deleteOne);

module.exports = router;
