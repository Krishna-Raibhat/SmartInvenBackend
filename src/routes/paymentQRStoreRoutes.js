// src/routes/paymentQRStoreRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const authMiddleware = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/paymentQRStoreController");

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
module.exports = router;
