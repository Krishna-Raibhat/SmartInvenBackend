// src/controllers/groceryBrandController.js
import service from "../services/groceryBrandService.js";

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

export const create = async (req, res) => {
  try {
    let { brand_name } = req.body;
    brand_name = String(brand_name || "").trim() .toLowerCase();

    if (!brand_name) {
      return fail(res, 400, "VALIDATION_REQUIRED_FIELDS", "brand_name is required.");
    }

    const created = await service.create({ brand_name });
    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    if (err.status) return fail(res, err.status, err.code || "ERROR", err.message);
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
    const { brand_id } = req.params;
    const data = await service.getById(brand_id);
    if (!data) return fail(res, 404, "NOT_FOUND", "Brand not found");
    return res.json({ success: true, data });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

export const update = async (req, res) => {
  try {
    const { brand_id } = req.params;
    let { brand_name } = req.body;
    brand_name = String(brand_name || "").trim() .toLowerCase();

    if (!brand_name) {
      return fail(res, 400, "VALIDATION_REQUIRED_FIELDS", "brand_name is required.");
    }

    const updated = await service.update(brand_id, { brand_name });
    if (!updated) return fail(res, 404, "NOT_FOUND", "Brand not found");

    return res.json({ success: true, data: updated });
  } catch (err) {
    if (err.status) return fail(res, err.status, err.code || "ERROR", err.message);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

export const remove = async (req, res) => {
  try {
    const { brand_id } = req.params;

    const deleted = await service.remove(brand_id);

    if (deleted === null) return fail(res, 404, "NOT_FOUND", "Brand not found");
    if (deleted === false) {
      return fail(
        res,
        409,
        "DELETE_BLOCKED",
        "Cannot delete brand because it is linked with one or more products."
      );
    }

    return res.json({ success: true, message: "Brand deleted successfully" });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};
