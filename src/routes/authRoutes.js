import { Router } from "express";
import multer from "multer";
import {
  register,
  login,
  logout,
  me,
  updateMe,
  changePassword,
  deleteAccount,
  forgotPasswordSendOtp,
  forgotPasswordVerifyOtp,
  forgotPasswordReset,
  superAdminLogin,
  getAllOwners,
  verifyRegistrationOtp,
  sendRegistrationOtp,
  verify2FA,
  setup2FA,
  enable2FA,
  disable2FA,
  sendDisable2FAOtp,
  googleLogin,
  appleLogin,
  getDevices,
  deleteDevice,
  approveDevice,
  denyDevice,
  getDeviceVerificationStatus,
  checkRegistrationAvailability,
} from "../controllers/authController.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import requireSuperAdmin from "../middlewares/requireSuperAdmin.js";
import {
  otpVerifyLimiter,
  deviceLoginLimiter,
} from "../middlewares/rateLimiter.js";

const router = Router();

const uploadLogo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

// Registration with OTP (Step 1: Submit form, Step 2: Verify OTP & Create account)
router.post("/register", uploadLogo.single("business_logo"), register);
router.post("/register/send-otp", sendRegistrationOtp);
router.post("/register/verify-otp", verifyRegistrationOtp);
router.post(
  "/register/check-registration-availability",
  checkRegistrationAvailability,
);

router.post("/login", deviceLoginLimiter, login);
router.post("/login/google", googleLogin);
router.post("/google", googleLogin);
router.post("/login/apple", appleLogin);
router.post("/apple", appleLogin);
router.post("/login/verify-2fa", otpVerifyLimiter, verify2FA);
router.post("/logout", authMiddleware, logout);

// Device verification via email links
router.get("/device-verification/approve", approveDevice);
router.get("/device-verification/deny", denyDevice);
router.get("/device-verification/status", getDeviceVerificationStatus);

router.get("/me", authMiddleware, me);
router.put(
  "/me",
  authMiddleware,
  uploadLogo.single("business_logo"),
  updateMe,
);

router.put("/change-password", authMiddleware, changePassword);
router.delete("/me", authMiddleware, deleteAccount);

router.post("/forgot-password", forgotPasswordSendOtp);
router.post("/forgot-password/verify-otp", forgotPasswordVerifyOtp);
router.post("/forgot-password/reset", forgotPasswordReset);

router.post("/super-admin/login", superAdminLogin);

router.get("/admin/owners", authMiddleware, requireSuperAdmin, getAllOwners);

router.post("/2fa/setup", authMiddleware, setup2FA);
router.post("/2fa/enable", authMiddleware, enable2FA);
router.post("/2fa/disable", authMiddleware, disable2FA);
router.post("/2fa/disable/send-otp", authMiddleware, sendDisable2FAOtp);

// Device Management
router.get("/devices", authMiddleware, getDevices);
router.delete("/devices/:device_id", authMiddleware, deleteDevice);

export default router;
