// src/controllers/clothingSalesController.js
const service = require("../services/clothingSalesService");

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

exports.create = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const sale = await service.createSale(owner_id, req.body);
    return res.status(201).json({ success: true, data: sale });
  } catch (e) {
    if (e.status) return fail(res, e.status, e.code || "ERROR", e.message);
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};

exports.getById = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const sale = await service.getById(owner_id, req.params.sales_id);
    if (!sale) return fail(res, 404, "NOT_FOUND", "Sale not found");
    return res.json({ success: true, data: sale });
  } catch (e) {
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

exports.creditList = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const data = await service.listCredit(owner_id);
    return res.json({ success: true, data });
  } catch (e) {
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};

exports.addPayment = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { amount } = req.body;
    const updated = await service.addPayment(owner_id, req.params.sales_id, amount);
    return res.json({ success: true, data: updated });
  } catch (e) {
    if (e.status) return fail(res, e.status, e.code || "ERROR", e.message);
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};

// ✅ BILL JSON API
exports.bill = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const bill = await service.getBill(owner_id, req.params.sales_id);
    return res.json({ success: true, data: bill });
  } catch (e) {
    if (e.status) return fail(res, e.status, e.code || "ERROR", e.message);
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};
