// src/routes/clothingSizeRoutes.js
import express from "express";
const router = express.Router();

import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/clothingSizeController.js";

// /api/clothing/sizes
router.post("/", auth, ctrl.create);
router.get("/", auth, ctrl.list);
router.get("/:size_id", auth, ctrl.getById);
router.put("/:size_id", auth, ctrl.update);
router.delete("/:size_id", auth, ctrl.remove);

export default router;
