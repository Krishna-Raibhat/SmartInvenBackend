// src/controllers/clothingProductController.js
const service = require("../services/clothingProductService");

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

exports.create = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    let { category_id, product_name } = req.body;

    category_id = String(category_id || "").trim();
    product_name = String(product_name || "").trim();

    if (!category_id || !product_name) {
      return fail(res, 400, "VALIDATION_REQUIRED_FIELDS", "category_id and product_name are required.");
    }

    const created = await service.create({ owner_id, category_id, product_name });
    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    if (err.status) return fail(res, err.status, err.code || "ERROR", err.message);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

exports.list = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const data = await service.list(owner_id);
    return res.json({ success: true, data });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

exports.getById = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { product_id } = req.params;

    const data = await service.getById(owner_id, product_id);
    if (!data) return fail(res, 404, "NOT_FOUND", "Product not found");

    return res.json({ success: true, data });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

exports.update = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { product_id } = req.params;

    let { category_id, product_name } = req.body;
    if (category_id !== undefined) category_id = String(category_id || "").trim();
    if (product_name !== undefined) product_name = String(product_name || "").trim();

    if (category_id === undefined && product_name === undefined) {
      return fail(res, 400, "VALIDATION_REQUIRED_FIELDS", "At least one field is required to update.");
    }

    const updated = await service.update(owner_id, product_id, { category_id, product_name });
    if (!updated) return fail(res, 404, "NOT_FOUND", "Product not found");

    return res.json({ success: true, data: updated });
  } catch (err) {
    if (err.status) return fail(res, err.status, err.code || "ERROR", err.message);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

exports.remove = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { product_id } = req.params;

    const deleted = await service.remove(owner_id, product_id);

    if (deleted === null) return fail(res, 404, "NOT_FOUND", "Product not found");
    if (deleted === false) {
      return fail(res, 409, "DELETE_BLOCKED", "Cannot delete product because it is used in stock or sales.");
    }

    return res.json({ success: true, message: "Product deleted successfully" });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};
