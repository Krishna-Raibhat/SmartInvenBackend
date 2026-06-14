// src/routes/storeDashboardRoutes.js
import express from "express";
import auth from "../middlewares/authMiddleware.js";
import { getDashboard } from "../controllers/storeDashboardController.js";

const router = express.Router();

router.get("/", auth, getDashboard);

export default router;
