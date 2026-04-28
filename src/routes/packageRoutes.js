import { Router } from "express";
import * as packageController from "../controllers/packageController.js";

const router = Router();

// Public routes
router.get("/", packageController.getAll);
router.get("/:id", packageController.getById);

// Admin routes (no auth for now, consistent with other admin endpoints)
router.post("/", packageController.create);
router.put("/:id", packageController.update);
router.delete("/:id", packageController.deletePackage);

export default router;
