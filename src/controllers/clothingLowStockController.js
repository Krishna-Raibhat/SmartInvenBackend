const service = require("../services/clothingLowStockService");

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

exports.lowStock = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const threshold = req.query.threshold ?? 40;
    const notify = String(req.query.notify || "0") === "1";

    const data = notify
      ? await service.notifyLowStock(owner_id, threshold)
      : await service.listLowStock(owner_id, threshold);

    return res.json({ success: true, data });
  } catch (e) {
    if (e.status) return fail(res, e.status, e.code || "ERROR", e.message);
    return fail(res, 500, "SERVER_ERROR", e.message);
  }
};
