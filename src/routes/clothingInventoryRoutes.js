const express = require("express");
const router = express.Router();

const auth = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/clothingInventoryController");

// Inventory list: products with category + total qty
router.get("/products", auth, ctrl.listProducts);

// Product details: lots grouped by variants
router.get("/products/:product_id", auth, ctrl.getProductDetails);

// Update a single lot (edit qty/notes/cp/sp if allowed)
router.patch("/lots/:lot_id", auth, ctrl.updateLot);

// Bulk upsert lots by variants (color -> sizes)
router.post("/products/:product_id/lots/bulk-upsert", auth, ctrl.bulkUpsertLots);

module.exports = router;
