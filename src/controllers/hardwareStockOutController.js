// src/controllers/hardwareStockOutController.js
const stockOutService = require("../services/hardwareStockOutService");

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

exports.createStockOut = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;

    const { customer_name,customer_phn_number,customer_address,payment_status, paid_amount, note, items } = req.body;

    const data = await stockOutService.createStockOut({
      owner_id,
      sold_by: owner_id,
      customer_name,
      customer_phn_number,
      customer_address,
      payment_status,
      paid_amount,
      note,
      items,
    });

    return res.status(201).json({
      success: true,
      message: "Stock out created successfully",
      data,
    });
  } catch (err) {
    return fail(res, err.status || 500, err.code || "SERVER_ERROR", err.message);
  }
};

exports.getStockOutById = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const result = await stockOutService.getStockOutById(owner_id, req.params.stockout_id);
    if (!result) return fail(res, 404, "NOT_FOUND", "Stock out not found");
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

exports.listStockOut = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const list = await stockOutService.listStockOut(owner_id);
    return res.status(200).json({ success: true, data: list });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};
