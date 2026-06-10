// src/routes/groceryInventoryLossRoutes.js
import express from "express";
import groceryInventoryLossController from "../controllers/groceryInventoryLossController.js";
import auth from "../middlewares/authMiddleware.js";

const router = express.Router();

// POST /api/grocery/inventory-losses - Record a new loss
router.post("/", auth, groceryInventoryLossController.create);

// GET /api/grocery/inventory-losses - List all losses
router.get("/", auth, groceryInventoryLossController.list);

// GET /api/grocery/inventory-losses/summary - Get loss summary
router.get("/summary", auth, groceryInventoryLossController.summary);

export default router;
