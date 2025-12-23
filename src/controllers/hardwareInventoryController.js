// src/controllers/hardwareInventoryController.js
const inventoryService = require("../services/hardwareInventoryService");

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

exports.listInventory = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const data = await inventoryService.listInventory(owner_id);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

exports.getInventoryDetail = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { product_id } = req.params;
    const supplier_id = req.query.supplier_id || null;

    const detail = await inventoryService.getInventoryDetail(owner_id, product_id, supplier_id);
    if (!detail) return fail(res, 404, "NOT_FOUND", "Product not found");

    return res.status(200).json({ success: true, data: detail });
  } catch (err) {
    return fail(res, err.status || 500, err.code || "SERVER_ERROR", err.message);
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { product_id } = req.params;
    const { product_name, category_id } = req.body;

    if (product_name === undefined && category_id === undefined) {
      return fail(res, 400, "VALIDATION_REQUIRED_FIELDS", "At least one field is required to update");
    }

    const updated = await inventoryService.updateProduct(owner_id, product_id, { product_name, category_id });
    if (!updated) return fail(res, 404, "NOT_FOUND", "Product not found");

    return res.status(200).json({ success: true, message: "Product updated", data: updated });
  } catch (err) {
    return fail(res, err.status || 500, err.code || "SERVER_ERROR", err.message);
  }
};

exports.updateLot = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { lot_id } = req.params;
    const { supplier_id, cp, sp, qty_in, notes } = req.body;

    if (supplier_id === undefined && cp === undefined && sp === undefined && qty_in === undefined && notes === undefined) {
      return fail(res, 400, "VALIDATION_REQUIRED_FIELDS", "At least one field is required to update");
    }

    const updated = await inventoryService.updateLot(owner_id, lot_id, { supplier_id, cp, sp, qty_in, notes });
    if (!updated) return fail(res, 404, "NOT_FOUND", "Lot not found");

    return res.status(200).json({ success: true, message: "Lot updated", data: updated });
  } catch (err) {
    return fail(res, err.status || 500, err.code || "SERVER_ERROR", err.message);
  }
};

exports.lowStock = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const threshold = Number(req.query.threshold ?? 40);
    const data = await inventoryService.listLowStock(owner_id, threshold);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return fail(res, err.status || 500, err.code || "SERVER_ERROR", err.message);
  }
};
exports.deleteProduct = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { product_id } = req.params;

    const result = await inventoryService.deleteProduct(owner_id, product_id);

    if (result === null) return fail(res, 404, "NOT_FOUND", "Product not found");
    if (result === false) return fail(res, 409, "DELETE_BLOCKED", "Cannot delete product: stock or sales exist");

    return res.status(200).json({ success: true, message: "Product deleted successfully" });
  } catch (err) {
    return fail(res, err.status || 500, err.code || "SERVER_ERROR", err.message);
  }
};
