// src/routes/hardwareCategoryRoutes.js
import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import * as categoryController from "../controllers/hardwareCategoryController.js";

const router = express.Router();

// REST style
router.post("/", authMiddleware, categoryController.createCategory);
router.get("/", authMiddleware, categoryController.listCategories);
router.put("/:category_id", authMiddleware, categoryController.updateCategory);
router.delete("/:category_id", authMiddleware, categoryController.deleteCategory);

export default router;
