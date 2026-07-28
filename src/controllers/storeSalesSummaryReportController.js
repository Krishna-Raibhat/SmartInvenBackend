// src/controllers/storeSalesSummaryReportController.js
import storeSalesSummaryReportService from "../services/storeSalesSummaryReportService.js";

const fail = (res, status, error_code, message) =>
  res.status(status).json({
    success: false,
    error_code,
    message,
  });

export const getSalesSummary = async (req, res) => {
  try {
    const owner_id = req.owner?.owner_id;

    if (!owner_id) {
      return fail(
        res,
        401,
        "AUTH_UNAUTHORIZED",
        "Unauthorized.",
      );
    }

    const { start, end, include } = req.query;

    const requestedSections = include
      ? include
          .split(",")
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean)
      : [
          "overview",
          "payment",
          "daily",
          "products",
          "recent",
        ];

    const data =
      await storeSalesSummaryReportService.getSalesSummary(
        owner_id,
        {
          start,
          end,
          include: requestedSections,
        },
      );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "Error fetching sales summary:",
      error,
    );

    return fail(
      res,
      500,
      "SERVER_ERROR",
      "Failed to load sales summary.",
    );
  }
};