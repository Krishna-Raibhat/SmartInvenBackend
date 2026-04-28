// src/routes/clothingCustomerReturnRoutes.js
import express from "express";
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/clothingCustomerReturnController.js";

const router = express.Router();

router.post("/", auth, ctrl.create);
router.get("/", auth, ctrl.list);
router.get("/:return_id", auth, ctrl.getById);

export default router;
