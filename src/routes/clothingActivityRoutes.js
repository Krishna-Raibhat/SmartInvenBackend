// src/routes/clothingActivityRoutes.js
import express from "express";
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/clothingActivityController.js";

const router = express.Router();

router.get("/", auth, ctrl.list); // /api/clothing/activities?limit=4

export default router;
