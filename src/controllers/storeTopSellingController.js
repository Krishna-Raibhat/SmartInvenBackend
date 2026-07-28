// src/controllers/storeTopSellingController.js

import storeTopSellingService from
  "../services/storeTopSellingService.js";

const allowedSections = new Set([
  "summary",
  "products",
  "returns",
  "stock",
  "trend",
  "categories",
  "comparison",
]);

const defaultSections = [
  "summary",
  "products",
  "returns",
  "stock",
  "trend",
  "categories",
  "comparison",
];

const fail = (
  res,
  status,
  code,
  message,
) =>
  res.status(status).json({
    success: false,
    error_code: code,
    message,
  });

class StoreTopSellingController {
  async getReport(req, res) {
    try {
      const ownerId = req.owner?.owner_id;

      if (!ownerId) {
        return fail(
          res,
          401,
          "AUTH_UNAUTHORIZED",
          "Unauthorized.",
        );
      }

      const { from, to, include } = req.query;

      const requestedSections = include
        ? include
            .split(",")
            .map((value) =>
              value.trim().toLowerCase(),
            )
            .filter((value) =>
              allowedSections.has(value),
            )
        : [];

      const sections =
        requestedSections.length > 0
          ? requestedSections
          : defaultSections;

      const data =
        await storeTopSellingService.getReport(
          ownerId,
          {
            from,
            to,
            include: sections,
          },
        );

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      console.error(
        "Top selling report error:",
        error,
      );

      const isDateError =
        error.message ===
          "Invalid report date range" ||
        error.message ===
          "The from date must be before or equal to the to date";

      return fail(
        res,
        isDateError ? 400 : 500,
        isDateError
          ? "INVALID_DATE_RANGE"
          : "SERVER_ERROR",
        isDateError
          ? error.message
          : "Failed to load top selling report.",
      );
    }
  }
}

export default new StoreTopSellingController();