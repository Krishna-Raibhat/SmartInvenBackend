import { Router } from "express";
import { register, login, me, updateMe, changePassword, forgotPasswordSendOtp, forgotPasswordVerifyOtp, forgotPasswordReset, superAdminLogin, getAllOwners } from "../controllers/authController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/register", register);
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
