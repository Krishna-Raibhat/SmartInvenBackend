// src/routes/clothingColorRoutes.js
import express from "express";
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/clothingColorController.js";

const router = express.Router();

// /api/clothing/colors
router.post("/", auth, ctrl.create);
router.get("/", auth, ctrl.list);
router.get("/:color_id", auth, ctrl.getById);
router.put("/:color_id", auth, ctrl.update);
router.delete("/:color_id", auth, ctrl.remove);

export default router;
