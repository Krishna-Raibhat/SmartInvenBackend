// src/routes/groceryBrandRoutes.js
import express from "express";
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/groceryBrandController.js";

const router = express.Router();

// /api/grocery/brands
router.post("/", auth, ctrl.create);
router.get("/", auth, ctrl.list);
router.get("/:brand_id", auth, ctrl.getById);
router.put("/:brand_id", auth, ctrl.update);
router.delete("/:brand_id", auth, ctrl.remove);

export default router;
