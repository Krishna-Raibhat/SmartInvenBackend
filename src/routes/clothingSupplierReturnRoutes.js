// src/routes/clothingSupplierReturnRoutes.js
import express from "express";
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/clothingSupplierReturnController.js";

const router = express.Router();

router.post("/", auth, ctrl.create);
router.get("/", auth, ctrl.list);
router.get("/:return_id", auth, ctrl.getById);

router.post("/:return_id/status", auth, ctrl.updateStatus); // {status:"approved"}
router.post("/:return_id/cancel", auth, ctrl.cancel);
router.delete("/:return_id", auth, ctrl.deleteOne);

export default router;
