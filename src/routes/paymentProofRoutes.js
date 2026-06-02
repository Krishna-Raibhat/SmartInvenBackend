// src/routes/paymentProofRoutes.js
import { Router } from "express";
import multer from "multer";
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/paymentProofController.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Owner routes - no auth required, owner_id sent as form field
router.post("/", auth, (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, error_code: "FILE_ERROR", message: err.message });
    next();
  });
}, ctrl.upload);
router.get("/my", auth, ctrl.myProofs);

// Admin routes
router.get("/admin/stats", ctrl.adminStats);
router.get("/admin/all", ctrl.adminAllProofs);
router.get("/admin", ctrl.adminList);
router.patch("/admin/:id/approve", ctrl.approve);
router.patch("/admin/:id/reject", ctrl.reject);

// Image view
router.get("/image/:owner_id/:filename", ctrl.viewImage);

export default router;
