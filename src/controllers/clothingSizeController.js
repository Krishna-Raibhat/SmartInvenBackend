// src/controllers/clothingSizeController.js
const service = require("../services/clothingSizeService");

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

exports.create = async (req, res) => {
  try {
    let { size_name } = req.body;
    size_name = String(size_name || "").trim();

    if (!size_name) {
      return fail(res, 400, "VALIDATION_REQUIRED_FIELDS", "size_name is required.");
    }

    const created = await service.create({ size_name });
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
    const { size_id } = req.params;
    const data = await service.getById(size_id);
    if (!data) return fail(res, 404, "NOT_FOUND", "Size not found");
    return res.json({ success: true, data });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

exports.update = async (req, res) => {
  try {
    const { size_id } = req.params;
    let { size_name } = req.body;
    size_name = String(size_name || "").trim();

    if (!size_name) {
      return fail(res, 400, "VALIDATION_REQUIRED_FIELDS", "size_name is required.");
    }

    const updated = await service.update(size_id, { size_name });
    if (!updated) return fail(res, 404, "NOT_FOUND", "Size not found");

    return res.json({ success: true, data: updated });
  } catch (err) {
    if (err.status) return fail(res, err.status, err.code || "ERROR", err.message);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

exports.remove = async (req, res) => {
  try {
    const { size_id } = req.params;

    const deleted = await service.remove(size_id);
    if (deleted === null) return fail(res, 404, "NOT_FOUND", "Size not found");
    if (deleted === false) {
      return fail(res, 409, "DELETE_BLOCKED", "Cannot delete size because it is used in stock or sales.");
    }

    return res.json({ success: true, message: "Size deleted successfully" });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};
