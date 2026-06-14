// src/controllers/storeCustomerReturnController.js
import storeCustomerReturnService from "../services/storeCustomerReturnService.js";

const fail = (res, status, code, message) =>
  res.status(status).json({ success: false, error_code: code, message });

const storeCustomerReturnController = {
  async create(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const result = await storeCustomerReturnService.createReturn(owner_id, req.body);
      return res.status(201).json({ success: true, data: result });
    } catch (err) {
      if (err.status) return fail(res, err.status, err.code || "ERROR", err.message);
      console.error("Error creating store customer return:", err);
      return fail(res, 500, "SERVER_ERROR", "Failed to create return.");
    }
  },

  async list(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const data = await storeCustomerReturnService.list(owner_id);
      return res.json({ success: true, data });
    } catch (err) {
      console.error("Error listing store customer returns:", err);
      return fail(res, 500, "SERVER_ERROR", "Failed to fetch returns.");
    }
  },

  async getById(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;
      const data = await storeCustomerReturnService.getById(owner_id, id);
      if (!data) return fail(res, 404, "NOT_FOUND", "Return not found.");
      return res.json({ success: true, data });
    } catch (err) {
      console.error("Error fetching store customer return:", err);
      return fail(res, 500, "SERVER_ERROR", "Failed to fetch return.");
    }
  },
};

export default storeCustomerReturnController;
