// src/routes/groceryNotificationRoutes.js
import express from "express";
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/groceryNotificationController.js";

const router = express.Router();

router.get("/", auth, ctrl.list);
router.post("/:id/read", auth, ctrl.markRead);
router.post("/read-all", auth, ctrl.markAllRead);
router.delete("/:id", auth, ctrl.deleteOne);

export default router;
