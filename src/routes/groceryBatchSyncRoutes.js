// src/routes/groceryBatchSyncRoutes.js
import express from "express";
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/groceryBatchSyncController.js";

const router = express.Router();

// Batch sync endpoint (push changes to server)
router.post("/", auth, ctrl.batchSync);

// Check sync status
router.post("/status", auth, ctrl.getSyncStatus);

// Pull changes from server
router.get("/pull", auth, ctrl.pullChanges);

export default router;
