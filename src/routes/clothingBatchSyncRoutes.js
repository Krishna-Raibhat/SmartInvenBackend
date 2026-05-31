// src/routes/clothingBatchSyncRoutes.js
import express from "express";
import auth from "../middlewares/authMiddleware.js";
import * as controller from "../controllers/clothingBatchSyncController.js";

const router = express.Router();

// Batch sync endpoint
router.post("/", auth, controller.batchSync);

export default router;
