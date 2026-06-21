// src/routes/storeBatchSyncRoutes.js
import express from "express";
import { batchSync, getMasterData } from "../controllers/storeBatchSyncController.js";
import auth from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/master-data", auth, getMasterData);
router.post("/", auth, batchSync);

export default router;