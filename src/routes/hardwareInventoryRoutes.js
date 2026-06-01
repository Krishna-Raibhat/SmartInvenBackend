import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/hardwareInventoryController.js";

const router = express.Router();

// List inventory grid
router.get("/", authMiddleware, ctrl.listInventory);

// Low stock MUST come before /:product_id
router.get("/low-stock", authMiddleware, ctrl.lowStock);

// Get product average cost
router.get("/:product_id/average-cost", authMiddleware, ctrl.getProductAverageCost);

// Product detail page
router.get("/:product_id", authMiddleware, ctrl.getInventoryDetail);

// Edit product
router.put("/product/:product_id", authMiddleware, ctrl.updateProduct);

// Edit lot
router.put("/lot/:lot_id", authMiddleware, ctrl.updateLot);

// Delete product
router.delete("/product/:product_id", authMiddleware, ctrl.deleteProduct);

export default router;
