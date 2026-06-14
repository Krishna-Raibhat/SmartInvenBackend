// src/controllers/storeSalesController.js
import storeSalesService from "../services/storeSalesService.js";

const fail = (res, status, code, message) =>
  res.status(status).json({ success: false, error_code: code, message });

const storeSalesController = {
  async create(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const result = await storeSalesService.createSale(owner_id, req.body);
      return res.status(201).json({ success: true, data: result });
    } catch (err) {
      if (err.status) return fail(res, err.status, err.code || "ERROR", err.message);
      console.error("Error creating store sale:", err);
      return fail(res, 500, "SERVER_ERROR", "Failed to create sale.");
    }
  },

  async list(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      // Fix #4: read pagination params from query
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
      const result = await storeSalesService.list(owner_id, { page, limit });
      return res.json({ success: true, ...result });
    } catch (err) {
      console.error("Error listing store sales:", err);
      return fail(res, 500, "SERVER_ERROR", "Failed to fetch sales.");
    }
  },

  async getById(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;
      const data = await storeSalesService.getById(owner_id, id);
      return res.json({ success: true, data });
    } catch (err) {
      if (err.status) return fail(res, err.status, err.code || "ERROR", err.message);
      console.error("Error fetching store sale:", err);
      return fail(res, 500, "SERVER_ERROR", "Failed to fetch sale.");
    }
  },

  async addPayment(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;
      const { amount } = req.body;

      if (amount === undefined || amount === null) {
        return fail(res, 400, "REQUIRED_FIELDS", "amount is required.");
      }

      const data = await storeSalesService.addPayment(owner_id, id, amount);
      return res.json({ success: true, data });
    } catch (err) {
      if (err.status) return fail(res, err.status, err.code || "ERROR", err.message);
      console.error("Error adding store sale payment:", err);
      return fail(res, 500, "SERVER_ERROR", "Failed to add payment.");
    }
  },

  async listCredit(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      // Fix #4: read pagination params from query
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
      const result = await storeSalesService.listCredit(owner_id, { page, limit });
      return res.json({ success: true, ...result });
    } catch (err) {
      console.error("Error listing store credit sales:", err);
      return fail(res, 500, "SERVER_ERROR", "Failed to fetch credit sales.");
    }
  },
};

export default storeSalesController;