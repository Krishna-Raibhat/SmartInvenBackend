// src/controllers/clothingSupplierReturnController.js
import service from "../services/clothingSupplierReturnService.js";

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

export const create = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const data = await service.createReturn(owner_id, req.body);
    return res.status(201).json({ success: true, data });
  } catch (e) {
    if (e.status) return fail(res, e.status, e.code || "ERROR", e.message);
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};

export const list = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const data = await service.list(owner_id);
    return res.json({ success: true, data });
  } catch (e) {
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};

export const getById = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const data = await service.getById(owner_id, req.params.return_id);
    if (!data) return fail(res, 404, "NOT_FOUND", "Return not found");
    return res.json({ success: true, data });
  } catch (e) {
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};

export const updateStatus = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { status } = req.body;
    const data = await service.updateStatus(owner_id, req.params.return_id, status);
    return res.json({ success: true, data });
  } catch (e) {
    if (e.status) return fail(res, e.status, e.code || "ERROR", e.message);
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};

export const cancel = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const data = await service.cancel(owner_id, req.params.return_id);
    return res.json({ success: true, data, message: "Return cancelled and stock restored" });
  } catch (e) {
    if (e.status) return fail(res, e.status, e.code || "ERROR", e.message);
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};

export const deleteOne = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const ok = await service.delete(owner_id, req.params.return_id);
    if (ok === null) return fail(res, 404, "NOT_FOUND", "Return not found");
    return res.json({ success: true, message: "Deleted" });
  } catch (e) {
    if (e.status) return fail(res, e.status, e.code || "ERROR", e.message);
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};
