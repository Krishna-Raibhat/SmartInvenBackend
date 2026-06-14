// src/routes/storeCustomerReturnRoutes.js
import express from "express";
import storeCustomerReturnController from "../controllers/storeCustomerReturnController.js";
import auth from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", auth, storeCustomerReturnController.create);
router.get("/", auth, storeCustomerReturnController.list);
router.get("/:id", auth, storeCustomerReturnController.getById);

export default router;
