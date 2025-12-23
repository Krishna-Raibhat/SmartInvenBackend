const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/hardwareInventoryController");

// // List inventory grid
// router.get("/", authMiddleware, ctrl.listInventory);

// // Product detail page (+ supplier filtering)
// router.get("/:product_id", authMiddleware, ctrl.getInventoryDetail);

// // Edit product (name/category/notes/default_cp/default_sp)
// router.put("/product/:product_id", authMiddleware, ctrl.updateProduct);

// // Edit a stock-lot/batch (supplier/cp/sp/qty/notes)
// router.put("/lot/:lot_id", authMiddleware, ctrl.updateLot);

// // Delete product
// router.delete("/product/:product_id", authMiddleware, ctrl.deleteProduct);

// router.get("/low-stock", authMiddleware, ctrl.lowStock);

// module.exports = router;
// List inventory grid
router.get("/", authMiddleware, ctrl.listInventory);

// Low stock MUST come before /:product_id
router.get("/low-stock", authMiddleware, ctrl.lowStock);

// Product detail page
router.get("/:product_id", authMiddleware, ctrl.getInventoryDetail);

// Edit product
router.put("/product/:product_id", authMiddleware, ctrl.updateProduct);

// Edit lot
router.put("/lot/:lot_id", authMiddleware, ctrl.updateLot);

// Delete product
router.delete("/product/:product_id", authMiddleware, ctrl.deleteProduct);

module.exports = router;