// src/routes/clothingCustomerReturnRoutes.js
const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/clothingCustomerReturnController");

router.post("/", auth, ctrl.create);
router.get("/", auth, ctrl.list);
router.get("/:return_id", auth, ctrl.getById);

module.exports = router;
