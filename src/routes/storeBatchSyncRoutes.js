// src/routes/storeBatchSyncRoutes.js
import express from "express";
import { batchSync, getMasterData,getStockLotsByProduct,
  getStockLotsBySupplier,
  getSalesList,
  getSaleById,
  getCustomerReturnsList, } from "../controllers/storeBatchSyncController.js";
import auth from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/master-data", auth, getMasterData);

router.get("/stock-lots/product/:product_id", auth, getStockLotsByProduct);
router.get("/stock-lots/supplier/:supplier_id", auth, getStockLotsBySupplier);
router.get("/sales", auth, getSalesList);
router.get("/sales/:sales_id", auth, getSaleById);
router.get("/customer-returns", auth, getCustomerReturnsList);

router.post("/", auth, batchSync);

export default router;