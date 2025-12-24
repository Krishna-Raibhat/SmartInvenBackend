const hardwareTopSellingService = require("../services/hardwareTopSellingService");

const validateDate = (res, date) => {
  if (!date) {
    return res.status(400).json({
      success: false,
      message: "DATE_REQUIRED",
      error: "Date is required.",
    });
  }
  let reportDate = new Date();
  if (date) {
    reportDate = new Date(date);

    //validate date
    if (isNaN(reportDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "INVALID_DATE",
        error: "Invalid date format. Use YYYY-MM-DD.",
      });
    }
    return reportDate;
  }
};



exports.getTopSellingProducts = async (req, res, next) => {
  try {
    const owner_id = req.owner?.owner_id;

    if (!owner_id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
        code: "UNAUTHORIZED",
      });
    }

    const {start_date} = req.query;

    const validatedDate=validateDate(res, start_date);

    const data = await hardwareTopSellingService.getTopSellingProducts(owner_id, validatedDate);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};
