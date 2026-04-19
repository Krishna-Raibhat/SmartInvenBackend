// src/routes/clothingNotificationRoutes.js
import express from "express";
const router = express.Router();
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/clothingNotificationController.js";

router.get("/", auth, ctrl.list);
router.post("/:id/read", auth, ctrl.markRead);
router.post("/read-all", auth, ctrl.markAllRead);
router.delete("/:id", auth, ctrl.deleteOne);


export default router;
