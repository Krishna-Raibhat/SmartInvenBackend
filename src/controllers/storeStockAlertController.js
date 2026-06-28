// src/controllers/storeStockAlertController.js
import storeStockAlertService from "../services/storeStockAlertService.js";

export async function getStockAlerts(req, res) {
  try {
    const owner_id = req.owner.owner_id;
    const lowThreshold = parseInt(req.query.lowThreshold) || 10;
    const criticalThreshold = parseInt(req.query.criticalThreshold) || 5;

    const result = await storeStockAlertService.getStockAlerts(owner_id, {
      lowThreshold,
      criticalThreshold,
    });

    return res.json(result);
  } catch (error) {
    console.error("Error fetching stock alerts:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch stock alerts",
    });
  }
}
