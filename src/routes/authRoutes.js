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
} from "../controllers/authController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = Router();

// Registration with OTP (Step 1: Submit form, Step 2: Verify OTP & Create account)
router.post("/register", register);
router.post("/register/", sendRegistrationOtp);
router.post("/register/verify-otp", verifyRegistrationOtp);

router.post("/login", login);

router.get("/me", authMiddleware, me);
router.put("/me", authMiddleware, updateMe);

router.put("/change-password", authMiddleware, changePassword);

router.post("/forgot-password", forgotPasswordSendOtp);
router.post("/forgot-password/verify-otp", forgotPasswordVerifyOtp);
router.post("/forgot-password/reset", forgotPasswordReset);

router.post("/super-admin/login", superAdminLogin);

router.get("/admin/owners", getAllOwners);

export default router;