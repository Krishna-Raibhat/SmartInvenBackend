// src/routes/storeStockLotRoutes.js
import express from "express";
import storeStockLotController from "../controllers/storeStockLotController.js";
import auth from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", auth, storeStockLotController.create);
router.get("/", auth, storeStockLotController.list);
router.get("/product/:product_id", auth, storeStockLotController.getByProduct); // ✅ must be before /:id
router.get("/:id", auth, storeStockLotController.getById);
router.patch("/:id", auth, storeStockLotController.update);
router.delete("/:id", auth, storeStockLotController.delete);

export default router;
