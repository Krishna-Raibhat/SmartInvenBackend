// src/routes/hardwareProductRoutes.js
import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/hardwareProductController.js";

const router = express.Router();

router.post("/", authMiddleware, ctrl.createProduct);
router.get("/", authMiddleware, ctrl.listProducts);
router.get("/:product_id", authMiddleware, ctrl.getProduct);
router.put("/:product_id", authMiddleware, ctrl.updateProduct);
router.delete("/:product_id", authMiddleware, ctrl.deleteProduct);

export default router;
