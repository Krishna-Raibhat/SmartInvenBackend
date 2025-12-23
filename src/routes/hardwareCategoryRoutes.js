// src/routes/hardwareCategoryRoutes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
const categoryController = require("../controllers/hardwareCategoryController");

// REST style
router.post("/", authMiddleware, categoryController.createCategory);
router.get("/", authMiddleware, categoryController.listCategories);
router.put("/:category_id", authMiddleware, categoryController.updateCategory);
router.delete("/:category_id", authMiddleware, categoryController.deleteCategory);

module.exports = router;
