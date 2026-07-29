// src/routes/paymentProofRoutes.js
import { Router } from "express";
import multer from "multer";
import auth from "../middlewares/authMiddleware.js";
import requireSuperAdmin from "../middlewares/requireSuperAdmin.js";
import * as ctrl from "../controllers/paymentProofController.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Owner routes - no auth required, owner_id sent as form field
// Owner routes - authenticated, owner_id derived from token
router.post("/", auth, (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, error_code: "FILE_ERROR", message: err.message });
    next();
  });
}, ctrl.upload);
router.get("/my", auth, ctrl.myProofs);

// Admin routes
// Admin routes — now protected
router.get("/admin/stats", auth, requireSuperAdmin, ctrl.adminStats);
router.get("/admin/all", auth, requireSuperAdmin, ctrl.adminAllProofs);
router.get("/admin", auth, requireSuperAdmin, ctrl.adminList);
router.patch("/admin/:id/approve", auth, requireSuperAdmin, ctrl.approve);
router.patch("/admin/:id/reject", auth, requireSuperAdmin, ctrl.reject);

// Image view
router.get("/image/:owner_id/:filename", ctrl.viewImage);

export default router;
