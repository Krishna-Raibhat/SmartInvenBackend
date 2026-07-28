// src/controllers/storePurchaseSummaryController.js

import storePurchaseSummaryService from
  "../services/storePurchaseSummaryService.js";

function sendError(
  res,
  statusCode,
  errorCode,
  message,
) {
  return res.status(statusCode).json({
    success: false,
    error_code: errorCode,
    message,
  });
}

function isValidDateString(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  const date = new Date(
    year,
    month - 1,
    day,
  );

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

class StorePurchaseSummaryController {
  /**
   * GET /api/store/reports/purchase-summary
   *
   * Query:
   * - from=YYYY-MM-DD
   * - to=YYYY-MM-DD
   */
  async getReport(req, res) {
    try {
      const ownerId =
        req.owner?.owner_id;

      const { from, to } = req.query;

      if (!ownerId) {
        return sendError(
          res,
          401,
          "AUTH_UNAUTHORIZED",
          "Unauthorized.",
        );
      }

      if (!from || !to) {
        return sendError(
          res,
          400,
          "MISSING_DATE_RANGE",
          "The from and to dates are required.",
        );
      }

      if (
        !isValidDateString(from) ||
        !isValidDateString(to)
      ) {
        return sendError(
          res,
          400,
          "INVALID_DATE_FORMAT",
          "Invalid date format. Use YYYY-MM-DD.",
        );
      }

      const fromDate = new Date(
        `${from}T00:00:00`,
      );

      const toDate = new Date(
        `${to}T00:00:00`,
      );

      if (fromDate > toDate) {
        return sendError(
          res,
          400,
          "INVALID_DATE_RANGE",
          "The from date must be before or equal to the to date.",
        );
      }

      const data =
        await storePurchaseSummaryService
          .getReport(ownerId, {
            from,
            to,
          });

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      console.error(
        "Purchase summary report error:",
        error,
      );

      return sendError(
        res,
        500,
        "SERVER_ERROR",
        error?.message ||
          "Failed to load purchase summary.",
      );
    }
  }
}

export default new StorePurchaseSummaryController();