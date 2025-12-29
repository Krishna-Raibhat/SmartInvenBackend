// src/routes/clothingSizeRoutes.js
const express = require("express");
const router = express.Router();

const auth = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/clothingSizeController");

// /api/clothing/sizes
router.post("/", auth, ctrl.create);
router.get("/", auth, ctrl.list);
router.get("/:size_id", auth, ctrl.getById);
router.put("/:size_id", auth, ctrl.update);
router.delete("/:size_id", auth, ctrl.remove);

module.exports = router;
