// src/routes/groceryDashboardRoutes.js
import express from "express";
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/groceryDashboardController.js";

const router = express.Router();

router.get("/", auth, ctrl.getDashboard);
router.get("/activities", auth, ctrl.getActivities);

export default router;
