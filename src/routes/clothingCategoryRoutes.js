// src/routes/clothingCategoryRoutes.js
const express = require("express");
const router = express.Router();

const auth = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/clothingCategoryController");

// /api/clothing/categories
router.post("/", auth, ctrl.create);
router.get("/", auth, ctrl.list);
router.get("/:category_id", auth, ctrl.getById);
router.put("/:category_id", auth, ctrl.update);
router.delete("/:category_id", auth, ctrl.remove);

module.exports = router;
