const hardwareProfitLossService = require("../services/hardwareProfitLossService");

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

const validateStartEndDate = (res, startDate, endDate) => {
  if(startDate>endDate){
    return res.status(400).json({
      success: false,
      message: "INVALID_DATE_RANGE",
      error: "Start date cannot be after end date.",
    });
  }
}

class HardwareProfitLossController {

  async getProfitLoss(req, res, next) {
    try {
        // Extract owner_id from authenticated user
      const owner_id = req.owner?.owner_id;
      
      // Ensure user is authenticated
      if (!owner_id) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized access",
          code: "UNAUTHORIZED",
        });
      }

  

      /* Validate period existence early (optional but helpful)
      if (!type) {
        return res.status(400).json({
          success: false,
          message: "Type is required",
          code: "TYPE_REQUIRED",
        });
      }*/


      const {start_date, end_date} = req.query
      const startDate=validateDate(res, start_date);
      const endDate=validateDate(res, end_date);
      validateStartEndDate(res, startDate, endDate);

      const result = await hardwareProfitLossService.getProfitLoss({
        owner_id,
        start_date: startDate,
        end_date: endDate,
      });

      // Send success response
      res.status(200).json({
        success: true,
        data: result,
      });

    } catch (error) {
      // Handle known application errors
      if (error.status && error.code) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
          code: error.code,
        });
      }

      // Pass unknown errors to global error handler
      next(error);
    }
  }
}

module.exports = new HardwareProfitLossController();
