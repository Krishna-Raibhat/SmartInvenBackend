// src/controllers/storeSupplierController.js
import storeSupplierService from "../services/storeSupplierService.js";

const storeSupplierController = {
  async create(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { supplier_name, phone, email, address } = req.body;

      if (!supplier_name || !phone) {
        return res.status(400).json({
          success: false,
          error_code: "REQUIRED_FIELDS",
          message: "supplier_name and phone are required.",
        });
      }

      const supplier = await storeSupplierService.create({
        owner_id,
        supplier_name,
        phone,
        email,
        address,
      });

      return res.status(201).json({
        success: true,
        data: supplier,
      });
    } catch (error) {
      if (error.code === "DUPLICATE") {
        return res.status(409).json({
          success: false,
          error_code: "DUPLICATE",
          message: error.message,
        });
      }

      console.error("Error creating store supplier:", error);
      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to create supplier.",
      });
    }
  },

  async list(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const suppliers = await storeSupplierService.list(owner_id);

      return res.status(200).json({
        success: true,
        data: suppliers,
      });
    } catch (error) {
      console.error("Error listing store suppliers:", error);
      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to fetch suppliers.",
      });
    }
  },

  async getById(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;

      const supplier = await storeSupplierService.getById(owner_id, id);

      return res.status(200).json({
        success: true,
        data: supplier,
      });
    } catch (error) {
      if (error.code === "NOT_FOUND") {
        return res.status(404).json({
          success: false,
          error_code: "NOT_FOUND",
          message: error.message,
        });
      }

      console.error("Error fetching store supplier:", error);
      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to fetch supplier.",
      });
    }
  },

  async update(req, res) {
    // const { supplier_name, phone, email, address } = req.body;
    const owner_id = req.owner.owner_id;
    const { id } = req.params;
    const { supplier_name, phone, email, address } = req.body;
    if (!supplier_name && !phone && email === undefined && address === undefined) {
      return res.status(400).json({
        success: false,
        error_code: "REQUIRED_FIELDS",
        message: "At least one field is required.",
      });
    }
    try {
      // const owner_id = req.owner.owner_id;
      // const { id } = req.params;
      // const { supplier_name, phone, email, address } = req.body;

      const supplier = await storeSupplierService.update(owner_id, id, {
        supplier_name,
        phone,
        email,
        address,
      });

      return res.status(200).json({
        success: true,
        data: supplier,
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

      console.error("Error updating store supplier:", error);
      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to update supplier.",
      });
    }
  },

  async delete(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;

      await storeSupplierService.remove(owner_id, id);

      return res.status(200).json({
        success: true,
        message: "Supplier deleted successfully.",
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

      console.error("Error deleting store supplier:", error);
      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to delete supplier.",
      });
    }
  },
};

export default storeSupplierController;
