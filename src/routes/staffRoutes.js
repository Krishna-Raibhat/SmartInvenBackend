// src/routes/staffRoutes.js
import { Router } from "express";
import staffController from "../controllers/staffController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = Router();

// Staff login is public — staff use this instead of /api/auth/login
router.post("/login", staffController.login);

// Staff forgot-password — public, OTP sent to the email on file
router.post("/forgot-password", staffController.forgotPasswordSendOtp);
router.post("/forgot-password/verify-otp", staffController.forgotPasswordVerifyOtp);
router.post("/forgot-password/reset", staffController.forgotPasswordReset);

// Only the owner (not a staff account) may manage staff
const ownerOnly = (req, res, next) => {
  if (req.staff) {
    return res.status(403).json({
      success: false,
      error_code: "OWNER_ONLY",
      message: "Only the business owner can manage staff accounts.",
    });
  }
  next();
};

// Only a staff account (not the owner) may use the self-service profile routes
const staffOnly = (req, res, next) => {
  if (!req.staff) {
    return res.status(403).json({
      success: false,
      error_code: "STAFF_ONLY",
      message: "This route is for staff accounts only.",
    });
  }
  next();
};

// Self-service — must come before the "/:id" routes below or "me" would be
// swallowed by the ":id" param.
router.get("/me", authMiddleware, staffOnly, staffController.me);
router.put("/me", authMiddleware, staffOnly, staffController.updateMe);

router.post("/", authMiddleware, ownerOnly, staffController.create);
router.get("/", authMiddleware, ownerOnly, staffController.list);
router.get("/:id", authMiddleware, ownerOnly, staffController.getById);
router.put("/:id", authMiddleware, ownerOnly, staffController.update);
router.delete("/:id", authMiddleware, ownerOnly, staffController.remove);

export default router;