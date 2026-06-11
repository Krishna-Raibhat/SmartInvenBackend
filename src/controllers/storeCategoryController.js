// src/controllers/storeCategoryController.js
import storeCategoryService from "../services/storeCategoryService.js";

const storeCategoryController = {
  async create(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { category_name } = req.body;

      if (!category_name) {
        return res.status(400).json({
          success: false,
          error_code: "REQUIRED_FIELDS",
          message: "category_name is required.",
        });
      }

      const category = await storeCategoryService.create({ owner_id, category_name });

      return res.status(201).json({
        success: true,
        data: category,
      });
    } catch (error) {
      if (error.code === "DUPLICATE") {
        return res.status(409).json({
          success: false,
          error_code: "DUPLICATE",
          message: error.message,
        });
      }
      if (error.code === "FORBIDDEN") {      // ← add this
        return res.status(403).json({
          success: false,
          error_code: "FORBIDDEN",
          message: error.message,
        });
      }
      if (error.code === "IN_USE") {
        return res.status(409).json({
          success: false,
          error_code: "IN_USE",
          message: error.message,
          details: error.details,
        });
      }
      console.error("Error creating store category:", error);
      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to create category.",
      });
    }
  },

  async list(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const categories = await storeCategoryService.list(owner_id);

      return res.status(200).json({
        success: true,
        data: categories,
      });
    } catch (error) {
      console.error("Error listing store categories:", error);
      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to fetch categories.",
      });
    }
  },

  async getById(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;

      const category = await storeCategoryService.getById(owner_id, id);

      if (!category) {
        return res.status(404).json({
          success: false,
          error_code: "NOT_FOUND",
          message: "Category not found.",
        });
      }

      return res.status(200).json({
        success: true,
        data: category,
      });
    } catch (error) {
      console.error("Error fetching store category:", error);
      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to fetch category.",
      });
    }
  },

  async update(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;
      const { category_name } = req.body;

      if (!category_name) {
        return res.status(400).json({
          success: false,
          error_code: "REQUIRED_FIELDS",
          message: "category_name is required.",
        });
      }

      const category = await storeCategoryService.update(owner_id, id, { category_name });

      return res.status(200).json({
        success: true,
        data: category,
      });
    } catch (error) {
      if (error.code === "NOT_FOUND") {
        return res.status(404).json({
          success: false,
          error_code: "NOT_FOUND",
          message: error.message,
        });
      }

      if (error.code === "DUPLICATE") {
        return res.status(409).json({
          success: false,
          error_code: "DUPLICATE",
          message: error.message,
        });
      }

      if (error.code === "FORBIDDEN") {
        return res.status(403).json({
          success: false,
          error_code: "FORBIDDEN",
          message: error.message,
        });
      }

      console.error("Error updating store category:", error);
      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to update category.",
      });
    }
  },

  async delete(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;

      await storeCategoryService.delete(owner_id, id);

      return res.status(200).json({
        success: true,
        message: "Category deleted successfully.",
      });
    } catch (error) {
      if (error.code === "NOT_FOUND") {
        return res.status(404).json({
          success: false,
          error_code: "NOT_FOUND",
          message: error.message,
        });
      }

      if (error.code === "FORBIDDEN") {
        return res.status(403).json({
          success: false,
          error_code: "FORBIDDEN",
          message: error.message,
        });
      }

      if (error.code === "IN_USE") {
        return res.status(409).json({
          success: false,
          error_code: "IN_USE",
          message: error.message,
          details: error.details,
        });
      }

      console.error("Error deleting store category:", error);
      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to delete category.",
      });
    }
  },
};

export default storeCategoryController;
