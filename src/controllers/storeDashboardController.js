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

export const getRecentActivities = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const data = await storeDashboardService.getRecentActivities(owner_id, limit);
    res.json({ success: true, data });
  } catch (err) {
    console.error("Store activities error:", err);
    res.status(500).json({ success: false, error_code: "SERVER_ERROR", message: err.message });
  }
};

export const getInventoryValue = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const data = await storeDashboardService.getInventoryValue(owner_id);
    res.json({ success: true, data });
  } catch (err) {
    console.error("Store inventory value error:", err);
    res.status(500).json({ success: false, error_code: "SERVER_ERROR", message: err.message });
  }
};

export const getLowStockItems = async (req, res) => {
  try {
    const owner_id  = req.owner.owner_id;
    const threshold = Math.max(1, parseInt(req.query.threshold) || 40);
    const limit     = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const data = await storeDashboardService.getLowStockItems(owner_id, threshold, limit);
    res.json({ success: true, data });
  } catch (err) {
    console.error("Store low stock error:", err);
    res.status(500).json({ success: false, error_code: "SERVER_ERROR", message: err.message });
  }
};
