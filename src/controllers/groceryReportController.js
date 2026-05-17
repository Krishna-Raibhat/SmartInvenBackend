import service from "../services/groceryReportService.js";

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

export const salesSummary = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { start, end } = req.query;

    const data = await service.salesSummary(owner_id, { start, end });
    return res.json({ success: true, data });
  } catch (e) {
    if (e.status) return fail(res, e.status, e.code || "ERROR", e.message);
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};

export const topProducts = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { start, end, limit } = req.query;

    const data = await service.topProducts(owner_id, { start, end, limit });
    return res.json({ success: true, data });
  } catch (e) {
    if (e.status) return fail(res, e.status, e.code || "ERROR", e.message);
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};

export const stockFlow = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { start, end, group } = req.query;

    const data = await service.stockFlow(owner_id, { start, end, group });
    return res.json({ success: true, data });
  } catch (e) {
    if (e.status) return fail(res, e.status, e.code || "ERROR", e.message);
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};

export const returnAnalytics = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { start, end } = req.query;

    const data = await service.returnAnalytics(owner_id, { start, end });
    return res.json({ success: true, data });
  } catch (e) {
    if (e.status) return fail(res, e.status, e.code || "ERROR", e.message);
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};
