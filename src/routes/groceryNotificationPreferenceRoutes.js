// src/routes/groceryNotificationPreferenceRoutes.js
import express from "express";
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/groceryNotificationPreferenceController.js";

const router = express.Router();

// Get all notification preferences for the user
router.get("/", auth, ctrl.getPreferences);

// Get preference for a specific notification type
router.get("/type", auth, ctrl.getPreferenceByType);

// Update preference for a specific notification type
router.put("/", auth, ctrl.updatePreference);

// Update multiple preferences at once
router.put("/batch", auth, ctrl.updateMultiplePreferences);

export default router;
