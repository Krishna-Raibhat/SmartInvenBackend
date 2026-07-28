import storeSalesItemReportService from
  "../services/storeSalesItemReportService.js";

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

const allowedSections = new Set([
  "summary",
  "returns",
  "categories",
  "products",
  "suppliers",
  "trend",
  "low_stock",
]);

const defaultSections = [
  "summary",
  "returns",
  "categories",
  "products",
  "suppliers",
  "trend",
  "low_stock",
];

const storeSalesItemReportController = {
  async salesByItem(req, res) {
    try {
      const owner_id =
        req.owner?.owner_id;

      if (!owner_id) {
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
        await storeSalesItemReportService
          .salesByItem(owner_id, {
            from,
            to,
            include: sections,
          });

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      console.error(
        "Error fetching sales-by-item report:",
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
          : "Failed to fetch report.",
      );
    }
  },
};

export default storeSalesItemReportController;