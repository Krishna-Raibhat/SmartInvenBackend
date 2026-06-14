// src/routes/storeNotificationRoutes.js
import express from "express";
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/storeNotificationController.js";

const router = express.Router();

// src/routes/storeNotificationRoutes.js
router.get("/", auth, ctrl.list);
router.post("/read-all", auth, ctrl.markAllRead);  // ✅ must come first
router.post("/:id/read", auth, ctrl.markRead);     // then the param route
router.delete("/:id", auth, ctrl.deleteOne);
export default router;
