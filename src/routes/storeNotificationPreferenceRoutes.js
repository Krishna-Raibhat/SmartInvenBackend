// src/routes/storeNotificationPreferenceRoutes.js
import express from "express";
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/storeNotificationController.js";

const router = express.Router();

router.get("/", auth, ctrl.getPreferences);
router.put("/", auth, ctrl.updatePreference);
router.get("/threshold", auth, ctrl.getThreshold);
router.put("/threshold", auth, ctrl.updateThreshold);

export default router;
