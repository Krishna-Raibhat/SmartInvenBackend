// src/controllers/storeReportController.js
import storeDashboardReportService from "../services/storeReportService.js";
import storeSalesByServiceReportService from "../services/storeSalesByServiceReportService.js";
import storeCustomerDueReportService from "../services/storeCustomerDueReportService.js";

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

  async salesByService(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { from, to } = req.query;
      const data = await storeSalesByServiceReportService.salesByService(owner_id, { from, to });
      return res.json({ success: true, data });
    } catch (err) {
      console.error("Error fetching sales by service report:", err);
      return fail(res, 500, "SERVER_ERROR", "Failed to fetch sales by service report.");
    }
  },

  async customerDues(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { from, to } = req.query;

      if (!from || !to) {
        return fail(res, 400, "REQUIRED_FIELDS", "Missing required parameters: from, to");
      }

      const data = await storeCustomerDueReportService.getReport(owner_id, { from, to });
      return res.json({ success: true, ...data });
    } catch (err) {
      console.error("Error fetching customer dues report:", err);
      return fail(res, 500, "SERVER_ERROR", "Failed to fetch customer dues report.");
    }
  },
};

export default storeDashboardReportController;