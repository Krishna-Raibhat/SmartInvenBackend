// src/controllers/storeDashboardController.js

import storeDashboardService from "../services/storeDashboardService.js";

const ALLOWED_PERIODS = new Set([
  "today",
  "this_month",
  "all_time",
]);

const fail = (res, status, code, message) =>
  res.status(status).json({
    success: false,
    error_code: code,
    message,
  });

export const getDashboardSummary = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;

    const period =
      req.query.period?.toString().trim() ||
      "today";

    if (!ALLOWED_PERIODS.has(period)) {
      return fail(
        res,
        400,
        "INVALID_PERIOD",
        "Invalid dashboard period.",
      );
    }

    const data =
      await storeDashboardService.getDashboardSummary(
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
      "Store dashboard summary error:",
      err,
    );

    return fail(
      res,
      err.status || 500,
      err.code || "SERVER_ERROR",
      err.message ||
        "Failed to load dashboard summary.",
    );
  }
};

export const getSalesChart = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;

    const data =
      await storeDashboardService.getSalesChart(
        owner_id,
      );

    return res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error(
      "Store sales chart error:",
      err,
    );

    return fail(
      res,
      500,
      "SERVER_ERROR",
      err.message ||
        "Failed to load sales chart.",
    );
  }
};

export const getRecentActivities = async (
  req,
  res,
) => {
  try {
    const owner_id = req.owner.owner_id;

    const limit = Math.min(
      50,
      Math.max(
        1,
        Number.parseInt(req.query.limit, 10) ||
          20,
      ),
    );

    const data =
      await storeDashboardService.getRecentActivities(
        owner_id,
        limit,
      );

    return res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error(
      "Store activities error:",
      err,
    );

    return fail(
      res,
      500,
      "SERVER_ERROR",
      err.message ||
        "Failed to load recent activities.",
    );
  }
};

export const getInventoryValue = async (
  req,
  res,
) => {
  try {
    const owner_id = req.owner.owner_id;

    const data =
      await storeDashboardService.getInventoryValue(
        owner_id,
      );

    return res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error(
      "Store inventory value error:",
      err,
    );

    return fail(
      res,
      500,
      "SERVER_ERROR",
      err.message ||
        "Failed to load inventory value.",
    );
  }
};

export const getLowStockItems = async (
  req,
  res,
) => {
  try {
    const owner_id = req.owner.owner_id;

    const limit = Math.min(
      100,
      Math.max(
        1,
        Number.parseInt(req.query.limit, 10) ||
          10,
      ),
    );

    const data =
      await storeDashboardService.getLowStockItems(
        owner_id,
        limit,
      );

    return res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error(
      "Store low-stock error:",
      err,
    );

    return fail(
      res,
      500,
      "SERVER_ERROR",
      err.message ||
        "Failed to load low-stock items.",
    );
  }
};