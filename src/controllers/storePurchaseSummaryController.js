// src/controllers/storePurchaseSummaryController.js
import storePurchaseSummaryService from "../services/storePurchaseSummaryService.js";

class StorePurchaseSummaryController {
  async getReport(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { from, to } = req.query;

      const data = await storePurchaseSummaryService.getReport(owner_id, { from, to });

      return res.json({ success: true, data });
    } catch (err) {
      console.error("Purchase summary report error:", err);
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to load purchase summary",
      });
    }
  }
}

export default new StorePurchaseSummaryController();
