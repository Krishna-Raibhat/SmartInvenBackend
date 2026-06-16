import storeSalesItemReportService from "../services/storeSalesItemReportService.js";

const fail = (res, status, code, message) =>
  res.status(status).json({ success: false, error_code: code, message });

const storeSalesItemReportController = {
  async salesByItem(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { from, to } = req.query;
      const data = await storeSalesItemReportService.salesByItem(owner_id, {
        from,
        to,
      });
      return res.json({ success: true, data });
    } catch (err) {
      console.error("Error fetching sales-by-item report:", err);
      return fail(res, 500, "SERVER_ERROR", "Failed to fetch report.");
    }
  },
};

export default storeSalesItemReportController;