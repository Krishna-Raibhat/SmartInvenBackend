// src/controllers/storeCurrentStockReportController.js
import storeCurrentStockReportService from "../services/storeCurrentStockReportService.js";

export async function getCurrentStock(req, res) {
  try {
    const owner_id = req.owner.owner_id;
    const result = await storeCurrentStockReportService.getCurrentStock(owner_id);
    return res.json(result);
  } catch (error) {
    console.error("Error fetching current stock report:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch current stock report",
    });
  }
}
