// src/routes/clothingCategoryRoutes.js
import express from "express";
const router = express.Router();

import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/clothingCategoryController.js";

// /api/clothing/categories
router.post("/", auth, ctrl.create);
router.get("/", auth, ctrl.list);
router.get("/:category_id", auth, ctrl.getById);
router.put("/:category_id", auth, ctrl.update);
router.delete("/:category_id", auth, ctrl.remove);

export default router;
