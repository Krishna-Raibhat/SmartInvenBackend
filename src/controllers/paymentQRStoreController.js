// src/controllers/paymentQRStoreController.js
const service = require("../services/paymentQRStoreService");

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

const ok = (res, status, data) =>
  res.status(status).json({ success: true, ...data });

// POST /api/payment-qr
exports.create = async (req, res) => {
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
exports.list = async (req, res) => {
  try {
    const data = await service.list();
    return ok(res, 200, { data, count: data.length });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

// GET /api/payment-qr/active
exports.getActive = async (req, res) => {
  try {
    const data = await service.getActive();
    if (!data) return fail(res, 404, "NOT_FOUND", "No active QR found");
    return ok(res, 200, { data });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

// GET /api/payment-qr/:id
exports.getById = async (req, res) => {
  try {
    const data = await service.getById(req.params.id);
    if (!data) return fail(res, 404, "NOT_FOUND", "QR not found");
    return ok(res, 200, { data });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

// PUT /api/payment-qr/:id
exports.update = async (req, res) => {
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
exports.activate = async (req, res) => {
  try {
    const data = await service.setActive(req.params.id);
    if (!data) return fail(res, 404, "NOT_FOUND", "QR not found");
    return ok(res, 200, { message: "QR activated", data });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

// PATCH /api/payment-qr/:id/deactivate
exports.deactivate = async (req, res) => {
  try {
    const data = await service.setInactive(req.params.id);
    if (!data) return fail(res, 404, "NOT_FOUND", "QR not found");
    return ok(res, 200, { message: "QR deactivated", data });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

// DELETE /api/payment-qr/:id
exports.remove = async (req, res) => {
  try {
    const result = await service.delete(req.params.id);
    if (!result) return fail(res, 404, "NOT_FOUND", "QR not found");
    return ok(res, 200, { message: "QR deleted successfully" });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};
