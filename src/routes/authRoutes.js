import express from "express";
import * as authController from "../controllers/authController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);

router.get("/me", authMiddleware, authController.me);
router.put("/me", authMiddleware, authController.updateMe);

router.put("/change-password", authMiddleware, authController.changePassword);

router.post("/forgot-password", authController.forgotPasswordSendOtp);
router.post("/forgot-password/verify-otp", authController.forgotPasswordVerifyOtp);
router.post("/forgot-password/reset", authController.forgotPasswordReset);

router.post("/super-admin/login", authController.superAdminLogin);

export default router;
