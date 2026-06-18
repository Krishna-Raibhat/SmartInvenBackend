// src/controllers/storeTopSellingController.js
import storeTopSellingService from "../services/storeTopSellingService.js";

class StoreTopSellingController {
  async getReport(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { from, to } = req.query;

      const data = await storeTopSellingService.getReport(owner_id, { from, to });

      return res.json({ success: true, data });
    } catch (err) {
      console.error("Top selling report error:", err);
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to load top selling report",
      });
    }
  }
}

export default new StoreTopSellingController();
