// src/routes/storeSupplierRoutes.js
import express from "express";
import storeSupplierController from "../controllers/storeSupplierController.js";
import auth from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", auth, storeSupplierController.create);
router.get("/", auth, storeSupplierController.list);
router.get("/:id", auth, storeSupplierController.getById);
router.put("/:id", auth, storeSupplierController.update);
router.delete("/:id", auth, storeSupplierController.delete);

export default router;
