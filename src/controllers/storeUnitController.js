// src/controllers/storeUnitController.js
import storeUnitService from "../services/storeUnitService.js";

const storeUnitController = {
  async create(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { unit_name } = req.body;

      if (!unit_name) {
        return res.status(400).json({
          success: false,
          error_code: "REQUIRED_FIELDS",
          message: "unit_name is required.",
        });
      }

      const unit = await storeUnitService.create({ owner_id, unit_name });

      return res.status(201).json({
        success: true,
        data: unit,
      });
    } catch (error) {
      if (error.code === "DUPLICATE") {
        return res.status(409).json({
          success: false,
          error_code: "DUPLICATE",
          message: error.message,
        });
      }

      console.error("Error creating store unit:", error);
      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to create unit.",
      });
    }
  },

  async list(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const units = await storeUnitService.list(owner_id);

      return res.status(200).json({
        success: true,
        data: units,
      });
    } catch (error) {
      console.error("Error listing store units:", error);
      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to fetch units.",
      });
    }
  },

  async getById(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;

      const unit = await storeUnitService.getById(owner_id, id);

      return res.status(200).json({
        success: true,
        data: unit,
      });
    } catch (error) {
      if (error.code === "NOT_FOUND") {
        return res.status(404).json({
          success: false,
          error_code: "NOT_FOUND",
          message: error.message,
        });
      }

      console.error("Error fetching store unit:", error);
      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to fetch unit.",
      });
    }
  },

  async update(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;
      const { unit_name } = req.body;

      if (!unit_name) {
        return res.status(400).json({
          success: false,
          error_code: "REQUIRED_FIELDS",
          message: "unit_name is required.",
        });
      }

      const unit = await storeUnitService.update(owner_id, id, { unit_name });

      return res.status(200).json({
        success: true,
        data: unit,
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

      console.error("Error updating store unit:", error);
      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to update unit.",
      });
    }
  },

  async delete(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;

      await storeUnitService.delete(owner_id, id);

      return res.status(200).json({
        success: true,
        message: "Unit deleted successfully.",
      });
    } catch (error) {
      if (error.code === "NOT_FOUND") {
        return res.status(404).json({
          success: false,
          error_code: "NOT_FOUND",
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
      console.error("Error deleting store unit:", error);
      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to delete unit.",
      });
    }
  },
};

export default storeUnitController;
