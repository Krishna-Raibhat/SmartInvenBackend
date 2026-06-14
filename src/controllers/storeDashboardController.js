// src/controllers/storeDashboardController.js
import storeDashboardService from "../services/storeDashboardService.js";

export const getDashboard = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const data = await storeDashboardService.getDashboard(owner_id);
    res.json({ success: true, data });
  } catch (err) {
    console.error("Store dashboard error:", err);
    res.status(500).json({ success: false, error_code: "SERVER_ERROR", message: err.message });
  }
};
