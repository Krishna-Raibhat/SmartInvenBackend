const reportService = require("../services/StockInOutReportService");

const validateOwner = (res, owner_id) => {
  if (!owner_id) {
    return res.status(400).json({
      success: false,
      message: "OWNER_ID_REQUIRED",
      error: "Owner ID is required.",
    });
  }
};

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

const validateReportType = (res, type) => {
  if (!type) {
    return res.status(400).json({
      success: false,
      message: "REPORT_TYPE_REQUIRED",
      error: "Report type is required.",
    });
  }

  const validTypes = ["daily", "weekly", "monthly", "yearly"];

  if (!validTypes.includes(type)) {
    return res.status(400).json({
      success: false,
      message: "INVALID_REPORT_TYPE",
      error: `Invalid report type. Valid types are: ${validTypes.join(", ")}`,
    });
  }
};

class HardwareReportController {
  // Stock-In Report (date range fixed)
  // GET /api/reports/stock-in?type=[daily,weekly,monthly,yearly]&date=YYYY-MM-DD
  async stockInFixed(req, res) {
    try {
      const owner_id = req.owner.owner_id;

      validateOwner(res, owner_id); //validate owner

      let { type, date } = req.query;

      type = type?.trim().toLowerCase();
      date = date?.trim();

      validateReportType(res, type); //validate report type

      const reportDate = validateDate(res, date); //validate date

      //fetch stock-in report
      const data = await reportService.stockInReportFixed(
        owner_id,
        type,
        reportDate
      );

      res.json({ success: true, data });
    } catch (err) {
      return {
        success: false,
        message: "SERVER_ERROR",
        error: err.message,
      };
    }
  }

  // Stock-Out Report
  // GET /api/reports/stock-out?type=[daily,weekly,monthly,yearly]&date=YYYY-MM-DD
  async stockOutFixed(req, res) {
    try {
      const owner_id = req.owner.owner_id;

      validateOwner(res, owner_id); //validate owner

      let { type, date } = req.query;

      type = type?.trim().toLowerCase();
      date = date?.trim();

      validateReportType(res, type); //validate report type

      const reportDate = validateDate(res, date); //validate date

      //fetch stock-out report
      const data = await reportService.stockOutReportFixed(
        owner_id,
        type,
        reportDate
      );

      res.json({ success: true, data });
    } catch (err) {
      return {
        success: false,
        message: "SERVER_ERROR",
        error: err.message,
      };
    }
  }

  // Combined Report
  // GET /api/reports/combined?type=[daily,weekly,monthly,yearly]&date=YYYY-MM-DD
  async combinedFixed(req, res) {
    try {
      const owner_id = req.owner.owner_id;

      validateOwner(res, owner_id); //validate owner

      let { type, date } = req.query;

      type = type?.trim().toLowerCase();
      date = date?.trim();

      validateReportType(res, type); //validate report type

      const reportDate = validateDate(res, date); //validate date

      //fetch stock-in/out report
      const data = await reportService.combinedReportFixed(
        owner_id,
        type,
        reportDate
      );

      res.json({ success: true, data });
    } catch (err) {
      return {
        success: false,
        message: "SERVER_ERROR",
        error: err.message,
      };
    }
  }

  // Stock-In Report (date range dynamic)
  // GET /api/reports/stock-in?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
  async stockIn(req, res) {
    try {
      const owner_id = req.owner.owner_id;

      validateOwner(res, owner_id); //validate owner

      let { startDate, endDate } = req.query;

      startDate = startDate?.trim();
      endDate = endDate?.trim();

      const validStartDate = validateDate(res, startDate); //validate start date
      const validEndDate = validateDate(res, endDate); //validate end date

      validateStartEndDate(res, validStartDate, validEndDate);//check start date is before end date

      //fetch stock-in report
      const data = await reportService.stockInReport(
        owner_id,
        validStartDate,
        validEndDate
      );

      res.json({ success: true, data });
    } catch (err) {
      return {
        success: false,
        message: "SERVER_ERROR",
        error: err.message,
      };
    }
  }

  // Stock-Out Report dynamic
  // GET /api/reports/stock-out?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
  async stockOut(req, res) {
    try {
      const owner_id = req.owner.owner_id;

      validateOwner(res, owner_id); //validate owner

      let { startDate, endDate } = req.query;

      startDate = startDate?.trim();
      endDate = endDate?.trim();

      const validStartDate = validateDate(res, startDate); //validate start date
      const validEndDate = validateDate(res, endDate); //validate end date

      validateStartEndDate(res, validStartDate, validEndDate);//check start date is before end date
      
      //fetch stock-out report
      const data = await reportService.stockOutReport(
        owner_id,
        validStartDate,
        validEndDate
      );

      res.json({ success: true, data });
    } catch (err) {
      return {
        success: false,
        message: "SERVER_ERROR",
        error: err.message,
      };
    }
  }
  // Combined Report dynamic
  // GET /api/reports/combined?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
  async combined(req, res) {
    try {
      const owner_id = req.owner.owner_id;

      validateOwner(res, owner_id); //validate owner

      let { startDate, endDate } = req.query;

      startDate = startDate?.trim();
      endDate = endDate?.trim();
      console.log("Received dates:", startDate, endDate);

      const validStartDate = validateDate(res, startDate); //validate start date
      const validEndDate = validateDate(res, endDate); //validate end date

      validateStartEndDate(res, validStartDate, validEndDate);//check start date is before end date
      //fetch stock-in/out report
      const data = await reportService.combinedReport(
        owner_id,
        validStartDate,
        validEndDate
      );

      res.json({ success: true, data });
    } catch (err) {
      return {
        success: false,
        message: "SERVER_ERROR",
        error: err.message,
      };
    }
  }
}

module.exports = new HardwareReportController();
