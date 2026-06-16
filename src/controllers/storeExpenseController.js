// src/controllers/storeExpenseController.js
import { expenseTitleService, expenseService } from "../services/storeExpenseService.js";

const fail = (res, status, code, message, extra = {}) =>
  res.status(status).json({ success: false, error_code: code, message, ...extra });

// ─────────────────────────────────────────────
// EXPENSE TITLE CONTROLLER
// ─────────────────────────────────────────────
export const expenseTitleController = {
  async create(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const data = await expenseTitleService.create(owner_id, req.body);
      return res.status(201).json({ success: true, data });
    } catch (err) {
      if (err.status) return fail(res, err.status, err.code, err.message);
      console.error("Error creating expense title:", err);
      return fail(res, 500, "SERVER_ERROR", "Failed to create expense title.");
    }
  },

  async list(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const data = await expenseTitleService.list(owner_id);
      return res.json({ success: true, data });
    } catch (err) {
      console.error("Error listing expense titles:", err);
      return fail(res, 500, "SERVER_ERROR", "Failed to fetch expense titles.");
    }
  },

  async getById(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;
      const data = await expenseTitleService.getById(owner_id, id);
      return res.json({ success: true, data });
    } catch (err) {
      if (err.status) return fail(res, err.status, err.code, err.message);
      console.error("Error fetching expense title:", err);
      return fail(res, 500, "SERVER_ERROR", "Failed to fetch expense title.");
    }
  },

  async update(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;
      const data = await expenseTitleService.update(owner_id, id, req.body);
      return res.json({ success: true, data });
    } catch (err) {
      if (err.status) return fail(res, err.status, err.code, err.message);
      console.error("Error updating expense title:", err);
      return fail(res, 500, "SERVER_ERROR", "Failed to update expense title.");
    }
  },

  async delete(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;
      await expenseTitleService.delete(owner_id, id);
      return res.json({ success: true, message: "Title deleted successfully." });
    } catch (err) {
      if (err.status) return fail(res, err.status, err.code, err.message, err.details ? { details: err.details } : {});
      console.error("Error deleting expense title:", err);
      return fail(res, 500, "SERVER_ERROR", "Failed to delete expense title.");
    }
  },
};

// ─────────────────────────────────────────────
// EXPENSE CONTROLLER
// ─────────────────────────────────────────────
export const expenseController = {
  async create(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const data = await expenseService.create(owner_id, req.body);
      return res.status(201).json({ success: true, data });
    } catch (err) {
      if (err.status) return fail(res, err.status, err.code, err.message);
      console.error("Error creating expense:", err);
      return fail(res, 500, "SERVER_ERROR", "Failed to create expense.");
    }
  },

  async list(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
      const { title_id } = req.query;
      const result = await expenseService.list(owner_id, { page, limit, title_id });
      return res.json({ success: true, ...result });
    } catch (err) {
      console.error("Error listing expenses:", err);
      return fail(res, 500, "SERVER_ERROR", "Failed to fetch expenses.");
    }
  },

  async getByTitle(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { title_id } = req.params;
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
      const result = await expenseService.getByTitle(owner_id, title_id, { page, limit });
      return res.json({ success: true, ...result });
    } catch (err) {
      if (err.status) return fail(res, err.status, err.code, err.message);
      console.error("Error fetching expenses by title:", err);
      return fail(res, 500, "SERVER_ERROR", "Failed to fetch expenses.");
    }
  },

  async getById(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;
      const data = await expenseService.getById(owner_id, id);
      return res.json({ success: true, data });
    } catch (err) {
      if (err.status) return fail(res, err.status, err.code, err.message);
      console.error("Error fetching expense:", err);
      return fail(res, 500, "SERVER_ERROR", "Failed to fetch expense.");
    }
  },

  async update(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;
      const data = await expenseService.update(owner_id, id, req.body);
      return res.json({ success: true, data });
    } catch (err) {
      if (err.status) return fail(res, err.status, err.code, err.message);
      console.error("Error updating expense:", err);
      return fail(res, 500, "SERVER_ERROR", "Failed to update expense.");
    }
  },

  async delete(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;
      await expenseService.delete(owner_id, id);
      return res.json({ success: true, message: "Expense deleted successfully." });
    } catch (err) {
      if (err.status) return fail(res, err.status, err.code, err.message);
      console.error("Error deleting expense:", err);
      return fail(res, 500, "SERVER_ERROR", "Failed to delete expense.");
    }
  },

  async summaryByTitle(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { start, end } = req.query;
      const data = await expenseService.summaryByTitle(owner_id, { start, end });
      return res.json({ success: true, data });
    } catch (err) {
      console.error("Error fetching expense summary:", err);
      return fail(res, 500, "SERVER_ERROR", "Failed to fetch expense summary.");
    }
  },

  // ── inside expenseController object, remove the export const and make it a normal method:
    async getReport(req, res) {
        try {
            const { start, end, group } = req.query;
            const data = await expenseService.getReport(req.owner.owner_id, { start, end, group });
            return res.json({ success: true, data });
        } catch (err) {
            return res.status(err.status || 500).json({ success: false, message: err.message });
        }
    },
};