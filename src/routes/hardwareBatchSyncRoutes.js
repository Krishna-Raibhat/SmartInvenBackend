// src/routes/hardwareBatchSyncRoutes.js
import express from "express";
import auth from "../middlewares/authMiddleware.js";
import * as controller from "../controllers/hardwareBatchSyncController.js";

const router = express.Router();

// Batch sync endpoint
router.post("/", auth, controller.batchSync);

export default router;
