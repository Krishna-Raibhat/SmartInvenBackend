// src/controllers/storeSupplierController.js
import storeSupplierService from "../services/storeSupplierService.js";
import { normalizeNepalPhone, isValidNepalPhone } from "../utils/phone.js";

const isValidEmail = (email) =>
  typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const storeSupplierController = {
  async create(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      let { supplier_name, phone, email, address } = req.body;

      supplier_name = String(supplier_name || "").trim();
      phone = String(phone || "").trim();

      if (!supplier_name || !phone) {
        return res.status(400).json({
          success: false,
          error_code: "REQUIRED_FIELDS",
          message: "supplier_name and phone are required.",
        });
      }

      phone = normalizeNepalPhone(phone);
      if (!isValidNepalPhone(phone)) {
        return res.status(400).json({
          success: false,
          error_code: "VALIDATION_PHONE_INVALID",
          message: "Invalid phone number. Please enter a valid Nepali number.",
        });
      }

      if (email !== undefined && email !== null) {
        email = String(email).trim();
        if (email && !isValidEmail(email)) {
          return res.status(400).json({
            success: false,
            error_code: "VALIDATION_EMAIL_INVALID",
            message: "Invalid email format.",
          });
        }
      }

      const supplier = await storeSupplierService.create({
        owner_id,
        supplier_name,
        phone,
        email: email || null,
        address: address ?? null,
      });

      return res.status(201).json({ success: true, data: supplier });
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

      return res.status(200).json({ success: true, data: suppliers });
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

      return res.status(200).json({ success: true, data: supplier });
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
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;
      let { supplier_name, phone, email, address } = req.body;

      if (
        supplier_name === undefined &&
        phone === undefined &&
        email === undefined &&
        address === undefined
      ) {
        return res.status(400).json({
          success: false,
          error_code: "REQUIRED_FIELDS",
          message: "At least one field is required.",
        });
      }

      const patch = {};

      if (supplier_name !== undefined) {
        patch.supplier_name = String(supplier_name || "").trim();
        if (patch.supplier_name === "") {
          return res.status(400).json({
            success: false,
            error_code: "VALIDATION_ERROR",
            message: "supplier_name cannot be empty.",
          });
        }
      }

      if (phone !== undefined) {
        phone = normalizeNepalPhone(String(phone || "").trim());
        if (!isValidNepalPhone(phone)) {
          return res.status(400).json({
            success: false,
            error_code: "VALIDATION_PHONE_INVALID",
            message:
              "Invalid phone number. Please enter a valid Nepali number.",
          });
        }
        patch.phone = phone;
      }

      if (email !== undefined) {
        if (email === null || String(email).trim() === "") {
          patch.email = null;
        } else {
          email = String(email).trim();
          if (!isValidEmail(email)) {
            return res.status(400).json({
              success: false,
              error_code: "VALIDATION_EMAIL_INVALID",
              message: "Invalid email format.",
            });
          }
          patch.email = email;
        }
      }

      if (address !== undefined) {
        patch.address = address === null ? null : String(address).trim();
      }

      const supplier = await storeSupplierService.update(owner_id, id, patch);
      return res.status(200).json({ success: true, data: supplier });
    } catch (error) {
      if (error.code === "NOT_FOUND") {
        return res
          .status(404)
          .json({
            success: false,
            error_code: "NOT_FOUND",
            message: error.message,
          });
      }
      if (error.code === "DUPLICATE") {
        return res
          .status(409)
          .json({
            success: false,
            error_code: "DUPLICATE",
            message: error.message,
          });
      }
      console.error("Error updating store supplier:", error);
      return res
        .status(500)
        .json({
          success: false,
          error_code: "SERVER_ERROR",
          message: "Failed to update supplier.",
        });
    }
  },

  async getLots(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;

      const lots = await storeSupplierService.getLots(owner_id, id);

      return res.status(200).json({
        success: true,
        data: lots,
      });
    } catch (error) {
      if (error.code === "NOT_FOUND") {
        return res.status(404).json({
          success: false,
          error_code: "NOT_FOUND",
          message: error.message,
        });
      }

      console.error("Error fetching supplier lots:", error);

      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to fetch supplier lots.",
      });
    }
  },

  // PATCH /:id/due — user manually sets due amount
  async setDue(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;
      const { due_amount } = req.body;

      if (due_amount === undefined || due_amount === null) {
        return res.status(400).json({
          success: false,
          error_code: "REQUIRED_FIELDS",
          message: "due_amount is required.",
        });
      }

      const parsed = parseFloat(due_amount);
      if (isNaN(parsed) || parsed < 0) {
        return res.status(400).json({
          success: false,
          error_code: "INVALID_AMOUNT",
          message: "due_amount must be a non-negative number.",
        });
      }

      const supplier = await storeSupplierService.setDue(owner_id, id, parsed);
      return res.status(200).json({ success: true, data: supplier });
    } catch (error) {
      if (error.code === "NOT_FOUND") {
        return res.status(404).json({
          success: false,
          error_code: "NOT_FOUND",
          message: error.message,
        });
      }
      if (error.code === "INVALID_AMOUNT") {
        return res.status(400).json({
          success: false,
          error_code: "INVALID_AMOUNT",
          message: error.message,
        });
      }
      console.error("Error setting store supplier due:", error);
      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to set due amount.",
      });
    }
  },

  // PATCH /:id/pay — user enters payment amount
  async recordPayment(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;
      const { amount, note } = req.body;

      if (amount === undefined || amount === null) {
        return res.status(400).json({
          success: false,
          error_code: "REQUIRED_FIELDS",
          message: "amount is required.",
        });
      }

      const parsed = parseFloat(amount);
      if (isNaN(parsed) || parsed <= 0) {
        return res.status(400).json({
          success: false,
          error_code: "INVALID_AMOUNT",
          message: "amount must be a positive number.",
        });
      }

      const supplier = await storeSupplierService.recordPayment(
        owner_id,
        id,
        parsed,
        note,
      );

      return res.status(200).json({ success: true, data: supplier });
    } catch (error) {
      if (error.code === "NOT_FOUND") {
        return res.status(404).json({
          success: false,
          error_code: "NOT_FOUND",
          message: error.message,
        });
      }

      if (error.code === "INVALID_AMOUNT") {
        return res.status(400).json({
          success: false,
          error_code: "INVALID_AMOUNT",
          message: error.message,
        });
      }

      if (error.code === "OVERPAYMENT") {
        return res.status(400).json({
          success: false,
          error_code: "OVERPAYMENT",
          message: error.message,
        });
      }

      console.error("Error recording store supplier payment:", error);
      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to record payment.",
      });
    }
  },

  async getPayments(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { id } = req.params;
      const payments = await storeSupplierService.getPayments(owner_id, id);
      return res.status(200).json({ success: true, data: payments });
    } catch (error) {
      console.error("Error fetching supplier payments:", error);
      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to fetch payments.",
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
