// src/routes/clothingProductRoutes.js
import express from "express";
const router = express.Router();

import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/clothingProductController.js";

// /api/clothing/products
router.post("/", auth, ctrl.create);
router.get("/", auth, ctrl.list);
router.get("/:product_id", auth, ctrl.getById);
router.put("/:product_id", auth, ctrl.update);
router.delete("/:product_id", auth, ctrl.remove);

export default router;
