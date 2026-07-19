import express from "express";
import * as ctrl from "../controllers/storeCustomerReminderController.js";
import auth from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", auth, ctrl.create);
router.get("/", auth, ctrl.list);
router.delete("/:id", auth, ctrl.deleteReminder);

export default router;
