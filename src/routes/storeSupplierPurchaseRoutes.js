// storeSupplierPurchaseRoutes.js
import express from "express";
import storeSupplierPurchaseController from "../controllers/storeSupplierPurchaseController.js";
import auth from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", auth, storeSupplierPurchaseController.create);
router.get("/", auth, storeSupplierPurchaseController.list);
router.get("/due/:supplier_id", auth, storeSupplierPurchaseController.getSupplierDue);
router.get("/:id", auth, storeSupplierPurchaseController.getById);
router.patch("/:id/pay", auth, storeSupplierPurchaseController.pay);

export default router;