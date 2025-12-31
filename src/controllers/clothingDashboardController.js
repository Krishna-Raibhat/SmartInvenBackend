// src/controllers/clothingDashboardController.js
const service = require("../services/clothingDashboardService");

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

exports.summary = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { start, end } = req.query;

    const data = await service.summary(owner_id, { start, end });
    return res.json({ success: true, data });
  } catch (e) {
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};
