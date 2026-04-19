import express from "express";
const router = express.Router();
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/notificationController.js";

router.get("/", auth, ctrl.list);                 // list notifications
router.post("/mark-all-read", auth, ctrl.markAllRead);
router.post("/:id/read", auth, ctrl.markRead);    // mark one read
router.delete("/:id", auth, ctrl.deleteOne);      // delete one

export default router;
