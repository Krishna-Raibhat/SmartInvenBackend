// src/routes/storeProductRoutes.js
import express from "express";
import storeProductController from "../controllers/storeProductController.js";
import auth from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", auth, storeProductController.create);
router.get("/", auth, storeProductController.list);
router.get("/:id", auth, storeProductController.getById);
router.patch("/:id", auth, storeProductController.update);
router.delete("/:id", auth, storeProductController.delete);

export default router;
