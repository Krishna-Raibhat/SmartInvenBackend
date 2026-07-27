// src/controllers/storeReportController.js

import storeDashboardReportService from "../services/storeReportService.js";
import storeSalesByServiceReportService from "../services/storeSalesByServiceReportService.js";
import storeCustomerDueReportService from "../services/storeCustomerDueReportService.js";

const fail = (res, status, code, message) =>
  res.status(status).json({
    success: false,
    error_code: code,
    message,
  });

const ALLOWED_REPORT_PERIODS = new Set([
  "today",
  "last_7_days",
  "this_month",
  "all_time",
]);

const storeDashboardReportController = {
  async getSummary(req, res) {
    try {
      const owner_id = req.owner.owner_id;

      const period =
        req.query.period?.toString().trim() ||
        "today";

      if (!ALLOWED_REPORT_PERIODS.has(period)) {
        return fail(
          res,
          400,
          "INVALID_PERIOD",
          "Invalid report period.",
        );
      }

      const data =
        await storeDashboardReportService.getSummary(
          owner_id,
          period,
        );

      return res.json({
        success: true,
        period,
        data,
      });
    } catch (err) {
      console.error(
        "Error fetching dashboard summary:",
        err,
      );

      return fail(
        res,
        err.status || 500,
        err.code || "SERVER_ERROR",
        err.message ||
          "Failed to fetch dashboard summary.",
      );
    }
  },

  async salesByService(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { from, to } = req.query;

      const data =
        await storeSalesByServiceReportService.salesByService(
          owner_id,
          { from, to },
        );

      return res.json({
        success: true,
        data,
      });
    } catch (err) {
      console.error(
        "Error fetching sales by service report:",
        err,
      );

      return fail(
        res,
        err.status || 500,
        err.code || "SERVER_ERROR",
        err.message ||
          "Failed to fetch sales by service report.",
      );
    }
  },

  async customerDues(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { from, to } = req.query;

      if (!from || !to) {
        return fail(
          res,
          400,
          "REQUIRED_FIELDS",
          "Missing required parameters: from, to",
        );
      }

      const data =
        await storeCustomerDueReportService.getReport(
          owner_id,
          { from, to },
        );

      return res.json({
        success: true,
        ...data,
      });
    } catch (err) {
      console.error(
        "Error fetching customer dues report:",
        err,
      );

      return fail(
        res,
        err.status || 500,
        err.code || "SERVER_ERROR",
        err.message ||
          "Failed to fetch customer dues report.",
      );
    }
  },
};

export default storeDashboardReportController;