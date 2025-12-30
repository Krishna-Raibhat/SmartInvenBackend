// src/controllers/clothingCustomerReturnController.js
const service = require("../services/clothingCustomerReturnService");

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

exports.create = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const data = await service.createReturn(owner_id, req.body);
    return res.status(201).json({ success: true, data });
  } catch (e) {
    if (e.status) return fail(res, e.status, e.code || "ERROR", e.message);
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};

exports.list = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const data = await service.list(owner_id);
    return res.json({ success: true, data });
  } catch (e) {
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};

exports.getById = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const data = await service.getById(owner_id, req.params.return_id);
    if (!data) return fail(res, 404, "NOT_FOUND", "Return not found");
    return res.json({ success: true, data });
  } catch (e) {
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};
