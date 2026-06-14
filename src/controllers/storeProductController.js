// src/controllers/storeProductController.js
import storeProductService from "../services/storeProductService.js";

const storeProductController = {
  async create(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { category_id, unit_id, product_name, type, description, cp, sp } = req.body;

      if (!product_name) {
        return res.status(400).json({
          success: false,
          error_code: "REQUIRED_FIELDS",
          message: "product_name is required.",
        });
      }

      if (!type) {
        return res.status(400).json({
          success: false,
          error_code: "REQUIRED_FIELDS",
          message: "type is required.",
        });
      }

      if (!["item", "service"].includes(type)) {
        return res.status(400).json({
          success: false,
          error_code: "INVALID_TYPE",
          message: "type must be either 'item' or 'service'.",
        });
      }

      const product = await storeProductService.create({
        owner_id,
        category_id,
        unit_id,
        product_name,
        type,
        description,
        cp,
        sp,
      });

      return res.status(201).json({ success: true, data: product });
    } catch (error) {
      if (error.code === "REQUIRED_FIELDS") {
        return res.status(400).json({ success: false, error_code: "REQUIRED_FIELDS", message: error.message });
      }
      if (error.code === "UNIT_NOT_FOUND") {
        return res.status(404).json({ success: false, error_code: "UNIT_NOT_FOUND", message: error.message });
      }
      if (error.code === "CATEGORY_NOT_FOUND") {
        return res.status(404).json({ success: false, error_code: "CATEGORY_NOT_FOUND", message: error.message });
      }
      if (error.code === "DUPLICATE") {
        return res.status(409).json({ success: false, error_code: "DUPLICATE", message: error.message });
      }
      console.error("Error creating store product:", error);
      return res.status(500).json({ success: false, error_code: "SERVER_ERROR", message: "Failed to create product." });
    }
  },

  async list(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const products = await storeProductService.list(owner_id);
      return res.status(200).json({ success: true, data: products });
    } catch (error) {
      console.error("Error listing store products:", error);
      return res.status(500).json({ success: false, error_code: "SERVER_ERROR", message: "Failed to fetch products." });
    }
  },

  async getById(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;
      const product = await storeProductService.getById(owner_id, id);
      return res.status(200).json({ success: true, data: product });
    } catch (error) {
      if (error.code === "NOT_FOUND") {
        return res.status(404).json({ success: false, error_code: "NOT_FOUND", message: error.message });
      }
      console.error("Error fetching store product:", error);
      return res.status(500).json({ success: false, error_code: "SERVER_ERROR", message: "Failed to fetch product." });
    }
  },

  async update(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;
      const { category_id, unit_id, product_name, type, description, cp, sp } = req.body;

      if (type && !["item", "service"].includes(type)) {
        return res.status(400).json({
          success: false,
          error_code: "INVALID_TYPE",
          message: "type must be either 'item' or 'service'.",
        });
      }

      const product = await storeProductService.update(owner_id, id, {
        category_id,
        unit_id,
        product_name,
        type,
        description,
        cp,
        sp,
      });

      return res.status(200).json({ success: true, data: product });
    } catch (error) {
      if (error.code === "NOT_FOUND") {
        return res.status(404).json({ success: false, error_code: "NOT_FOUND", message: error.message });
      }
      if (error.code === "REQUIRED_FIELDS") {
        return res.status(400).json({ success: false, error_code: "REQUIRED_FIELDS", message: error.message });
      }
      if (error.code === "UNIT_NOT_FOUND") {
        return res.status(404).json({ success: false, error_code: "UNIT_NOT_FOUND", message: error.message });
      }
      if (error.code === "CATEGORY_NOT_FOUND") {
        return res.status(404).json({ success: false, error_code: "CATEGORY_NOT_FOUND", message: error.message });
      }
      if (error.code === "DUPLICATE") {
        return res.status(409).json({ success: false, error_code: "DUPLICATE", message: error.message });
      }
      console.error("Error updating store product:", error);
      return res.status(500).json({ success: false, error_code: "SERVER_ERROR", message: "Failed to update product." });
    }
  },

  async delete(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;
      await storeProductService.delete(owner_id, id);
      return res.status(200).json({ success: true, message: "Product deleted successfully." });
    } catch (error) {
      if (error.code === "NOT_FOUND") {
        return res.status(404).json({ success: false, error_code: "NOT_FOUND", message: error.message });
      }
      if (error.code === "IN_USE") {
        return res.status(409).json({ success: false, error_code: "IN_USE", message: error.message, details: error.details });
      }
      console.error("Error deleting store product:", error);
      return res.status(500).json({ success: false, error_code: "SERVER_ERROR", message: "Failed to delete product." });
    }
  },
};

export default storeProductController;