// src/routes/storeCategoryRoutes.js
import express from "express";
import storeCategoryController from "../controllers/storeCategoryController.js";
import auth from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", auth, storeCategoryController.create);
router.get("/", auth, storeCategoryController.list);
router.get("/:id", auth, storeCategoryController.getById);
router.put("/:id", auth, storeCategoryController.update);
router.delete("/:id", auth, storeCategoryController.delete);

export default router;
