const service = require("../services/clothingReportService");

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

exports.salesCostPaid = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { start, end, group } = req.query;
    const data = await service.salesCostPaid(owner_id, { start, end, group });
    res.json({ success: true, data });
  } catch (e) {
    if (e.status) return fail(res, e.status, e.code || "ERROR", e.message);
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};

exports.topProducts = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { start, end, metric, limit } = req.query;
    const data = await service.topProducts(owner_id, {
      start,
      end,
      metric,
      limit,
    });
    res.json({ success: true, data });
  } catch (e) {
    if (e.status) return fail(res, e.status, e.code || "ERROR", e.message);
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};

exports.stockFlow = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { start, end, group } = req.query;
    const data = await service.stockFlow(owner_id, { start, end, group });
    res.json({ success: true, data });
  } catch (e) {
    if (e.status) return fail(res, e.status, e.code || "ERROR", e.message);
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};

// Download CSV for report tables
exports.download = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { start, end, group, type, format } = req.query;
    const fmt = String(format || "csv").toLowerCase();

    if (fmt !== "csv") {
      return fail(res, 400, "VALIDATION_FORMAT", "Only csv is supported right now");
    }

    // type: "sales" | "stock"
    let rows = [];
    if (type === "sales") {
      rows = await service.salesCostPaid(owner_id, { start, end, group });
    } else {
      rows = await service.stockFlow(owner_id, { start, end, group });
    }

    const csv = service.toCSV(rows);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${type || "stock"}_report.csv"`
    );
    return res.status(200).send(csv);
  } catch (e) {
    if (e.status) return fail(res, e.status, e.code || "ERROR", e.message);
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};
