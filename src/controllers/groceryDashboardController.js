// src/controllers/groceryDashboardController.js
import service from "../services/groceryDashboardService.js";

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

export const getDashboard = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const data = await service.getDashboard(owner_id);
    return res.json({ success: true, data });
  } catch (e) {
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};

export const getActivities = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const limit = Number(req.query.limit ?? 4);
    const data = await service.getRecentActivities(owner_id, limit);
    return res.json({ success: true, data });
  } catch (e) {
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};
