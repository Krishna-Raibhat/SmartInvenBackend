// src/controllers/storeProfitLossController.js
import service from "../services/storeProfitLossService.js";

const fail = (res, status, code, message) =>
  res.status(status).json({ success: false, error_code: code, message });

export const summary = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { start, end } = req.query;
    const data = await service.summary(owner_id, { start, end });
    res.json({ success: true, data });
  } catch (err) {
    console.error("Store profit/loss summary error:", err);
    fail(res, 500, "SERVER_ERROR", err.message);
  }
};

export const salesChart = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { start, end, group } = req.query;
    const data = await service.salesChart(owner_id, { start, end, group });
    res.json({ success: true, data });
  } catch (err) {
    console.error("Store sales chart error:", err);
    fail(res, 500, "SERVER_ERROR", err.message);
  }
};

export const topProducts = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { start, end, limit } = req.query;
    const data = await service.topProducts(owner_id, { start, end, limit });
    res.json({ success: true, data });
  } catch (err) {
    console.error("Store top products error:", err);
    fail(res, 500, "SERVER_ERROR", err.message);
  }
};

export const returnAnalytics = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { start, end } = req.query;
    const data = await service.returnAnalytics(owner_id, { start, end });
    res.json({ success: true, data });
  } catch (err) {
    console.error("Store return analytics error:", err);
    fail(res, 500, "SERVER_ERROR", err.message);
  }
};
