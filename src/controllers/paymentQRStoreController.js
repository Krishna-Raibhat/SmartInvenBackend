// src/controllers/paymentQRStoreController.js
import service from "../services/paymentQRStoreService.js";

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

const ok = (res, status, data) =>
  res.status(status).json({ success: true, ...data });

// POST /api/payment-qr
export const create = async (req, res) => {
  try {
    if (!req.file) {
      return fail(res, 400, "VALIDATION_REQUIRED_FIELDS", "QR image file is required");
    }

    const data = await service.create(req.file.buffer, req.file.mimetype);
    return ok(res, 201, { data });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

// GET /api/payment-qr
export const list = async (req, res) => {
  try {
    const data = await service.list();
    return ok(res, 200, { data, count: data.length });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

// GET /api/payment-qr/active
export const getActive = async (req, res) => {
  try {
    const data = await service.getActive();
    if (!data) return fail(res, 404, "NOT_FOUND", "No active QR found");
    return ok(res, 200, { data });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

// GET /api/payment-qr/:id
export const getById = async (req, res) => {
  try {
    const data = await service.getById(req.params.id);
    if (!data) return fail(res, 404, "NOT_FOUND", "QR not found");
    return ok(res, 200, { data });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

// PUT /api/payment-qr/:id
export const update = async (req, res) => {
  try {
    if (!req.file) {
      return fail(res, 400, "VALIDATION_REQUIRED_FIELDS", "QR image file is required");
    }

    const data = await service.update(req.params.id, req.file.buffer, req.file.mimetype);
    if (!data) return fail(res, 404, "NOT_FOUND", "QR not found");
    return ok(res, 200, { data });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

// PATCH /api/payment-qr/:id/activate
export const activate = async (req, res) => {
  try {
    const data = await service.setActive(req.params.id);
    if (!data) return fail(res, 404, "NOT_FOUND", "QR not found");
    return ok(res, 200, { message: "QR activated", data });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

// PATCH /api/payment-qr/:id/deactivate
export const deactivate = async (req, res) => {
  try {
    const data = await service.setInactive(req.params.id);
    if (!data) return fail(res, 404, "NOT_FOUND", "QR not found");
    return ok(res, 200, { message: "QR deactivated", data });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

// DELETE /api/payment-qr/:id
export const remove = async (req, res) => {
  try {
    const result = await service.delete(req.params.id);
    if (!result) return fail(res, 404, "NOT_FOUND", "QR not found");
    return ok(res, 200, { message: "QR deleted successfully" });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};
