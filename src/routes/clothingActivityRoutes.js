// src/routes/clothingActivityRoutes.js
import express from "express";
const router = express.Router();
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/clothingActivityController.js";

router.get("/", auth, ctrl.list); // /api/clothing/activities?limit=4

export default router;
