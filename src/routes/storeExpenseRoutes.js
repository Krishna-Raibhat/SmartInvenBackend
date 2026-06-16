// src/routes/storeExpenseRoutes.js
import express from "express";
import { expenseTitleController, expenseController } from "../controllers/storeExpenseController.js";
import auth from "../middlewares/authMiddleware.js";

const router = express.Router();

// ─────────────────────────────────────────────
// EXPENSE TITLE ROUTES
// /store/expenses/titles
// ─────────────────────────────────────────────
router.post("/titles", auth, expenseTitleController.create);
router.get("/titles", auth, expenseTitleController.list);
router.get("/titles/:id", auth, expenseTitleController.getById);
router.patch("/titles/:id", auth, expenseTitleController.update);
router.delete("/titles/:id", auth, expenseTitleController.delete);

// ─────────────────────────────────────────────
// EXPENSE ROUTES
// /store/expenses
// ─────────────────────────────────────────────
router.post("/", auth, expenseController.create);
router.get("/", auth, expenseController.list);
router.get("/summary", auth, expenseController.summaryByTitle);
router.get("/report", auth, expenseController.getReport);        // ← before /:id
router.get("/by-title/:title_id", auth, expenseController.getByTitle);
router.get("/:id", auth, expenseController.getById);
router.patch("/:id", auth, expenseController.update);
router.delete("/:id", auth, expenseController.delete);
export default router;