import { Router } from "express";
import {
  register,
  login,
  me,
  updateMe,
  changePassword,
  forgotPasswordSendOtp,
  forgotPasswordVerifyOtp,
  forgotPasswordReset,
  superAdminLogin,
  getAllOwners,
  verifyRegistrationOtp,
  sendRegistrationOtp,
  verifyDevice,
  verifyDeviceOTP,
  resendDeviceOTP,
  verify2FA,
  setup2FA,
  enable2FA,
  disable2FA,
  googleLogin,
  getDevices,
  deleteDevice,
  approveDevice,
  denyDevice,
  getDeviceVerificationStatus,
  checkRegistrationAvailability,
} from "../controllers/authController.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import {
  otpVerifyLimiter,
  deviceLoginLimiter,
  deviceVerifyLimiter,
} from "../middlewares/rateLimiter.js";

const router = Router();

// Registration with OTP (Step 1: Submit form, Step 2: Verify OTP & Create account)
router.post("/register", register);
router.post("/register/", sendRegistrationOtp);
router.post("/register/verify-otp", verifyRegistrationOtp);
router.post(
  "/register/check-registration-availability",
  checkRegistrationAvailability,
);

router.post("/login", deviceLoginLimiter, login);
router.post("/login/google", googleLogin);
router.post("/login/verify-device", deviceVerifyLimiter, verifyDevice);
router.post("/verify-device-otp", deviceVerifyLimiter, verifyDeviceOTP);
router.post("/resend-device-otp", resendDeviceOTP);
router.post("/login/verify-2fa", otpVerifyLimiter, verify2FA);

// Device verification via email links
router.get("/device-verification/approve", approveDevice);
router.get("/device-verification/deny", denyDevice);
router.get("/device-verification/status", getDeviceVerificationStatus);

router.get("/me", authMiddleware, me);
router.put("/me", authMiddleware, updateMe);

router.put("/change-password", authMiddleware, changePassword);

router.post("/forgot-password", forgotPasswordSendOtp);
router.post("/forgot-password/verify-otp", forgotPasswordVerifyOtp);
router.post("/forgot-password/reset", forgotPasswordReset);

router.post("/super-admin/login", superAdminLogin);

router.get("/admin/owners", getAllOwners);

router.post("/2fa/setup", authMiddleware, setup2FA);
router.post("/2fa/enable", authMiddleware, enable2FA);
router.post("/2fa/disable", authMiddleware, disable2FA);

// Device Management
router.get("/devices", authMiddleware, getDevices);
router.delete("/devices/:device_id", authMiddleware, deleteDevice);

export default router;
