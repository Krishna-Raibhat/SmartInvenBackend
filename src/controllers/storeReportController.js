// src/controllers/storeReportController.js
import storeDashboardReportService from "../services/storeReportService.js";

const fail = (res, status, code, message) =>
  res.status(status).json({ success: false, error_code: code, message });

const storeDashboardReportController = {
  async getSummary(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const data = await storeDashboardReportService.getSummary(owner_id);
      return res.json({ success: true, data });
    } catch (err) {
      console.error("Error fetching dashboard summary:", err);
      return fail(res, 500, "SERVER_ERROR", "Failed to fetch dashboard summary.");
    }
  },
};

export default storeDashboardReportController;