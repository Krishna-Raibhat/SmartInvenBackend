// src/controllers/clothingCategoryController.js
const service = require("../services/clothingCategoryService");

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

exports.create = async (req, res) => {
  try {
    let { category_name } = req.body;
    category_name = String(category_name || "").trim();

    if (!category_name) {
      return fail(res, 400, "VALIDATION_REQUIRED_FIELDS", "category_name is required.");
    }

    const created = await service.create({ category_name });
    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    if (err.status) return fail(res, err.status, err.code || "ERROR", err.message);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

exports.list = async (_req, res) => {
  try {
    const data = await service.list();
    return res.json({ success: true, data });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

exports.getById = async (req, res) => {
  try {
    const { category_id } = req.params;
    const data = await service.getById(category_id);
    if (!data) return fail(res, 404, "NOT_FOUND", "Category not found");
    return res.json({ success: true, data });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

exports.update = async (req, res) => {
  try {
    const { category_id } = req.params;
    let { category_name } = req.body;
    category_name = String(category_name || "").trim();

    if (!category_name) {
      return fail(res, 400, "VALIDATION_REQUIRED_FIELDS", "category_name is required.");
    }

    const updated = await service.update(category_id, { category_name });
    if (!updated) return fail(res, 404, "NOT_FOUND", "Category not found");

    return res.json({ success: true, data: updated });
  } catch (err) {
    if (err.status) return fail(res, err.status, err.code || "ERROR", err.message);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

exports.remove = async (req, res) => {
  try {
    const { category_id } = req.params;

    const deleted = await service.remove(category_id);

    if (deleted === null) return fail(res, 404, "NOT_FOUND", "Category not found");
    if (deleted === false) {
      return fail(
        res,
        409,
        "DELETE_BLOCKED",
        "Cannot delete category because it is linked with one or more products."
      );
    }

    return res.json({ success: true, message: "Category deleted successfully" });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};
