// src/controllers/clothingColorController.js
import service from "../services/clothingColorService.js";

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

export const create = async (req, res) => {
  try {
    let { color_name } = req.body;
    color_name = String(color_name || "").trim();

    if (!color_name) {
      return fail(
        res,
        400,
        "VALIDATION_REQUIRED_FIELDS",
        "color_name is required.",
      );
    }

    const created = await service.create({ color_name });
    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    if (err.status)
      return fail(res, err.status, err.code || "ERROR", err.message);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

export const list = async (_req, res) => {
  try {
    const data = await service.list();
    return res.json({ success: true, data });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

export const getById = async (req, res) => {
  try {
    const { color_id } = req.params;
    const data = await service.getById(color_id);
    if (!data) return fail(res, 404, "NOT_FOUND", "Color not found");
    return res.json({ success: true, data });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

export const update = async (req, res) => {
  try {
    const { color_id } = req.params;
    let { color_name } = req.body;
    color_name = String(color_name || "").trim();

    if (!color_name) {
      return fail(
        res,
        400,
        "VALIDATION_REQUIRED_FIELDS",
        "color_name is required.",
      );
    }

    const updated = await service.update(color_id, { color_name });
    if (!updated) return fail(res, 404, "NOT_FOUND", "Color not found");

    return res.json({ success: true, data: updated });
  } catch (err) {
    if (err.status)
      return fail(res, err.status, err.code || "ERROR", err.message);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

export const remove = async (req, res) => {
  try {
    const { color_id } = req.params;

    const deleted = await service.remove(color_id);
    if (deleted === null) return fail(res, 404, "NOT_FOUND", "Color not found");
    if (deleted === false) {
      return fail(
        res,
        409,
        "DELETE_BLOCKED",
        "Cannot delete color because it is used in stock or sales.",
      );
    }

    return res.json({ success: true, message: "Color deleted successfully" });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};
