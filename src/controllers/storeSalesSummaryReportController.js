// src/controllers/storeReportController.js
import storeSalesSummaryReportService from "../services/storeSalesSummaryReportService.js";

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

export const getSalesSummary = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { start, end } = req.query;

    const data = await storeSalesSummaryReportService.getSalesSummary(owner_id, { start, end });

    return res.json({ success: true, data });
  } catch (err) {
    console.error("Error fetching sales summary:", err);
    console.error("Error details:", err.message);
    console.error("Error stack:", err.stack);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};