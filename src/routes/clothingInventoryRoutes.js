import express from "express";
const router = express.Router();

import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/clothingInventoryController.js";

// Inventory list: products with category + total qty
router.get("/products", auth, ctrl.listProducts);

// Product details: lots grouped by variants
router.get("/products/:product_id", auth, ctrl.getProductDetails);

// Update a single lot (edit qty/notes/cp/sp if allowed)
router.patch("/lots/:lot_id", auth, ctrl.updateLot);

// Bulk upsert lots by variants (color -> sizes)
router.post("/products/:product_id/lots/bulk-upsert", auth, ctrl.bulkUpsertLots);

export default router;
