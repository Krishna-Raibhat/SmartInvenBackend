// src/routes/paymentQRStoreRoutes.js
import express from "express";
import multer from "multer";
import authMiddleware from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/paymentQRStoreController.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});
router.post("/", authMiddleware, upload.single("qr_image"), ctrl.create);
router.get("/", authMiddleware, ctrl.list);
router.get("/active", ctrl.getActive);
router.get("/:id", authMiddleware, ctrl.getById);
router.put("/:id", authMiddleware, upload.single("qr_image"), ctrl.update);
router.patch("/:id/activate", authMiddleware, ctrl.activate);
router.patch("/:id/deactivate", authMiddleware, ctrl.deactivate);
router.delete("/:id", authMiddleware, ctrl.remove);

export default router;
