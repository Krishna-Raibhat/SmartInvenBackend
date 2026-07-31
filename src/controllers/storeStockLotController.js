// src/controllers/storeStockLotController.js
import storeStockLotService from "../services/storeStockLotService.js";

const storeStockLotController = {
  
  async create(req, res) {
    try {
      const owner_id = req.owner.owner_id;

      const {
        supplier_id,
        bill_number,
        lot_date,
        items,

        // Keep these temporarily for compatibility
        // with the old single-product frontend.
        product_id,
        qty_in,
        cp,
        sp,
      } = req.body;

      /*
      * New request:
      * items: [...]
      *
      * Old request:
      * product_id, qty_in, cp, sp
      *
      * Both become one normalized items array.
      */
      const normalizedItems = Array.isArray(items)
        ? items
        : product_id
          ? [
              {
                product_id,
                qty_in,
                cp,
                sp,
              },
            ]
          : [];

      const result =
        await storeStockLotService.create({
          owner_id,
          supplier_id,
          bill_number,
          lot_date,
          items: normalizedItems,
        });

      return res.status(201).json({
        success: true,
        message:
          result.total_products === 1
            ? "Stock added successfully."
            : `${result.total_products} products stocked in successfully.`,
        data: result,
      });
    } catch (error) {
      if (error.code === "PRODUCT_NOT_FOUND") {
        return res.status(404).json({
          success: false,
          error_code: error.code,
          message: error.message,
          details: error.details,
        });
      }

      if (error.code === "SUPPLIER_NOT_FOUND") {
        return res.status(404).json({
          success: false,
          error_code: error.code,
          message: error.message,
        });
      }

      if (error.code === "BILL_NUMBER_EXISTS") {
        return res.status(409).json({
          success: false,
          error_code: error.code,
          message: error.message,
        });
      }

      if (
        error.code === "VALIDATION_ERROR" ||
        error.code === "REQUIRED_FIELDS"
      ) {
        return res.status(400).json({
          success: false,
          error_code: error.code,
          message: error.message,
          details: error.details,
        });
      }

            if (error.code === "P2028") {
        console.error(
          "Database transaction timeout:",
          error,
        );

        return res.status(503).json({
          success: false,
          error_code: "DATABASE_BUSY",
          message:
            "The database is currently busy. Please try again.",
        });
      }

      console.error(
        "Error creating store stock lots:",
        error,
      );

      return res.status(500).json({
        success: false,
        error_code: "SERVER_ERROR",
        message: "Failed to add stock.",
      });
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
      const { cp, sp, qty_in, qty_remaining, bill_number, lot_date } = req.body;

      if (
        cp === undefined &&
        sp === undefined &&
        qty_in === undefined &&
        qty_remaining === undefined &&
        bill_number === undefined &&
        lot_date === undefined
      ) {
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
        bill_number, // pass through as-is (string or null); service normalizes it
        lot_date, // pass through as-is (string date); service parses and validates it
      });

      return res.status(200).json({ success: true, data: lot });
    } catch (error) {
      if (error.code === "NOT_FOUND") {
        return res.status(404).json({ success: false, error_code: "NOT_FOUND", message: error.message });
      }
      if (error.code === "BILL_NUMBER_EXISTS") {
        return res.status(409).json({ success: false, error_code: "BILL_NUMBER_EXISTS", message: error.message });
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