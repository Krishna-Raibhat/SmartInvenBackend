const hardwareTopSellingService = require("../services/hardwareTopSellingService");

// ================= VALIDATOR =================
const validateDate = (date) => {
  if (!date) {
    const err = new Error("Date is required");
    err.status = 400;
    err.code = "DATE_REQUIRED";
    throw err;
  }

  const reportDate = new Date(date);

  if (isNaN(reportDate.getTime())) {
    const err = new Error("Invalid date format. Use YYYY-MM-DD.");
    err.status = 400;
    err.code = "INVALID_DATE";
    throw err;
  }

  return reportDate;
};

// ================= CONTROLLER =================
exports.getTopSellingProducts = async (req, res, next) => {
  console.log("🔥 TOP SELLING CONTROLLER HIT");
  try {
    const owner_id = req.owner?.owner_id;

    if (!owner_id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
        code: "UNAUTHORIZED",
      });
    }

    const { start_date } = req.query;

    const validatedDate = validateDate(start_date);

    const data = await hardwareTopSellingService.getTopSellingProducts(
      owner_id,
      validatedDate
    );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};