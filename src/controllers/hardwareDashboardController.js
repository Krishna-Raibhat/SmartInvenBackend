// src/controllers/hardwareDashboardController.js
const dashboardService = require("../services/hardwareDashboardService");

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

exports.summary = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const data = await dashboardService.summary(owner_id);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};
