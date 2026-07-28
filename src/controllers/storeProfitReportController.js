import storeProfitReportService from
  "../services/storeProfitReportService.js";

const allowedSections = new Set([
  "summary",
  "top_items",
  "expenses",
  "categories",
  "monthly",
  "daily",
]);

const defaultSections = [
  "summary",
  "top_items",
  "expenses",
  "categories",
  "monthly",
  "daily",
];

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

const storeProfitReportController = {
  /**
   * GET /api/store/reports/profit
   *
   * Query:
   * - from=YYYY-MM-DD
   * - to=YYYY-MM-DD
   * - include=summary,top_items,expenses,categories
   */
  async getReport(req, res) {
    try {
      const ownerId = req.owner?.owner_id;
      const { from, to, include } = req.query;

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
          "Missing required parameters: from and to.",
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

      const rawSections = include
      ? String(include)
          .split(",")
          .map((section) =>
            section.trim().toLowerCase(),
          )
          .filter(Boolean)
      : [];

    const invalidSections =
      rawSections.filter(
        (section) =>
          !allowedSections.has(section),
      );

    if (invalidSections.length > 0) {
      return sendError(
        res,
        400,
        "INVALID_REPORT_SECTION",
        `Invalid report section: ${invalidSections.join(", ")}`,
      );
    }

    const sections =
      rawSections.length > 0
        ? [...new Set(rawSections)]
        : defaultSections;

      console.log(
        "📊 Profit report request:",
        {
          ownerId,
          from,
          to,
          sections,
        },
      );

      const report =
        await storeProfitReportService.getReport(
          ownerId,
          {
            from,
            to,
            include: sections,
          },
        );

      return res.status(200).json({
        success: true,
        data: report,
      });
    } catch (error) {
      console.error(
        "❌ Profit report error:",
        error,
      );

      return sendError(
        res,
        500,
        "SERVER_ERROR",
        error?.message ||
          "Failed to generate profit report.",
      );
    }
  },
};

export default storeProfitReportController;