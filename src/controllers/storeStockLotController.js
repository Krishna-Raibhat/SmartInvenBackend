// src/controllers/storeStockLotController.js
import storeStockLotService from "../services/storeStockLotService.js";

const storeStockLotController = {
  async create(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { product_id, supplier_id, qty_in, cp, sp } = req.body;

      if (!product_id) {
        return res.status(400).json({
          success: false,
          error_code: "REQUIRED_FIELDS",
          message: "product_id is required.",
        });
      }

      if (!qty_in || Number(qty_in) <= 0) {
        return res.status(400).json({
          success: false,
          error_code: "REQUIRED_FIELDS",
          message: "qty_in must be greater than 0.",
        });
      }

      if (!cp) {
        return res.status(400).json({
          success: false,
          error_code: "REQUIRED_FIELDS",
          message: "cp is required.",
        });
      }

      if (!sp) {
        return res.status(400).json({
          success: false,
          error_code: "REQUIRED_FIELDS",
          message: "sp is required.",
        });
      }

      const lot = await storeStockLotService.create({
        owner_id,
        product_id,
        supplier_id,
        qty_in: Number(qty_in),
        cp: Number(cp),
        sp: Number(sp),
      });

      return res.status(201).json({ success: true, data: lot });
    } catch (error) {
      if (error.code === "PRODUCT_NOT_FOUND") {
        return res.status(404).json({ success: false, error_code: "PRODUCT_NOT_FOUND", message: error.message });
      }
      if (error.code === "SUPPLIER_NOT_FOUND") {
        return res.status(404).json({ success: false, error_code: "SUPPLIER_NOT_FOUND", message: error.message });
      }
      if (error.code === "VALIDATION_ERROR") {
        return res.status(400).json({ success: false, error_code: "VALIDATION_ERROR", message: error.message });
      }
      if (error.code === "REQUIRED_FIELDS") {
        return res.status(400).json({ success: false, error_code: "REQUIRED_FIELDS", message: error.message });
      }
      console.error("Error creating store stock lot:", error);
      return res.status(500).json({ success: false, error_code: "SERVER_ERROR", message: "Failed to create stock lot." });
    }
  },

  async list(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const lots = await storeStockLotService.list(owner_id);
      return res.status(200).json({ success: true, data: lots });
    } catch (error) {
      console.error("Error listing store stock lots:", error);
      return res.status(500).json({ success: false, error_code: "SERVER_ERROR", message: "Failed to fetch stock lots." });
    }
  },

  async getByProduct(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { product_id } = req.params;
      const lots = await storeStockLotService.getByProduct(owner_id, product_id);
      return res.status(200).json({ success: true, data: lots });
    } catch (error) {
      if (error.code === "PRODUCT_NOT_FOUND") {
        return res.status(404).json({ success: false, error_code: "PRODUCT_NOT_FOUND", message: error.message });
      }
      if (error.code === "VALIDATION_ERROR") {
        return res.status(400).json({ success: false, error_code: "VALIDATION_ERROR", message: error.message });
      }
      console.error("Error fetching lots by product:", error);
      return res.status(500).json({ success: false, error_code: "SERVER_ERROR", message: "Failed to fetch stock lots." });
    }
  },

  async getById(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;
      const lot = await storeStockLotService.getById(owner_id, id);
      return res.status(200).json({ success: true, data: lot });
    } catch (error) {
      if (error.code === "NOT_FOUND") {
        return res.status(404).json({ success: false, error_code: "NOT_FOUND", message: error.message });
      }
      console.error("Error fetching store stock lot:", error);
      return res.status(500).json({ success: false, error_code: "SERVER_ERROR", message: "Failed to fetch stock lot." });
    }
  },

  async update(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;
      const { cp, sp, qty_in, qty_remaining } = req.body;

      if (cp === undefined && sp === undefined && qty_in === undefined && qty_remaining === undefined) {
        return res.status(400).json({
          success: false,
          error_code: "REQUIRED_FIELDS",
          message: "At least one field is required to update.",
        });
      }

      const lot = await storeStockLotService.update(owner_id, id, {
        cp: cp !== undefined ? Number(cp) : undefined,
        sp: sp !== undefined ? Number(sp) : undefined,
        qty_in: qty_in !== undefined ? Number(qty_in) : undefined,
        qty_remaining: qty_remaining !== undefined ? Number(qty_remaining) : undefined,
      });

      return res.status(200).json({ success: true, data: lot });
    } catch (error) {
      if (error.code === "NOT_FOUND") {
        return res.status(404).json({ success: false, error_code: "NOT_FOUND", message: error.message });
      }
      if (error.code === "VALIDATION_ERROR") {
        return res.status(400).json({ success: false, error_code: "VALIDATION_ERROR", message: error.message });
      }
      console.error("Error updating store stock lot:", error);
      return res.status(500).json({ success: false, error_code: "SERVER_ERROR", message: "Failed to update stock lot." });
    }
  },

  async delete(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;
      await storeStockLotService.delete(owner_id, id);
      return res.status(200).json({ success: true, message: "Stock lot deleted successfully." });
    } catch (error) {
      if (error.code === "NOT_FOUND") {
        return res.status(404).json({ success: false, error_code: "NOT_FOUND", message: error.message });
      }
      if (error.code === "IN_USE") {
        return res.status(409).json({ success: false, error_code: "IN_USE", message: error.message, details: error.details });
      }
      console.error("Error deleting store stock lot:", error);
      return res.status(500).json({ success: false, error_code: "SERVER_ERROR", message: "Failed to delete stock lot." });
    }
  },
};

export default storeStockLotController;