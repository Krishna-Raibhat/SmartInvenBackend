// src/routes/groceryBatchSyncRoutes.js
import express from "express";
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/groceryBatchSyncController.js";

const router = express.Router();

// Batch sync endpoint
router.post("/batch", auth, ctrl.batchSync);

// Check sync status
router.post("/status", auth, ctrl.getSyncStatus);

export default router;
