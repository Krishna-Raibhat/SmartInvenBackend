import express from "express";
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/clothingStockLotController.js";

const router = express.Router();

// bulk stock-in
router.post("/bulk", auth, ctrl.bulkCreate);

// get all lots for authenticated owner
router.get("/", auth, ctrl.getAll);

// get lot by barcode scan
router.get("/scan/:barcode", auth, ctrl.getByBarcode);

// preview barcode image
router.get("/:lot_id/barcode-image", auth, ctrl.getBarcodeImage);

router.get(
  "/stock-lots",
  authenticateOwner,
  clothingStockLotController.getSupplierLots,
);

export default router;
