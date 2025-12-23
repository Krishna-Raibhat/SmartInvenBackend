const reportService = require("../services/StockInOutReportService");

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });
class HardwareReportController {

  async validateOwner(owner_id) {
    if (!owner_id) {
      return fail(res, 401, "UNAUTHORIZED", "Owner authentication required.");
    }
  }

  async validateDate(date) {
    if (!date) {
      return fail(res, 400, "DATE_REQUIRED", "Date is required.");
    }
    let reportDate = new Date();
    if (date) {      
      reportDate = new Date(date);

      //validate date
      if (isNaN(reportDate.getTime())) {
        return fail(
          res,
          400,
          "INVALID_DATE",
          "Provided date is invalid. Use YYYY-MM-DD"
        );
      }
      return reportDate;
    }
  }

  async validateReportType(type) {
    if (!type) {
      return fail(res, 400, "TYPE_REQUIRED", "Report type is required.");
    }

    const validTypes = ["daily", "weekly", "monthly", "yearly"];

    if (!validTypes.includes(type)) {
      return fail(
        res,
        400,
        "INVALID_REPORT_TYPE",
        `Invalid type. Allowed types are: ${validTypes.join(", ")}`
      );
    }
  }

  // Stock-In Report
  // GET /api/reports/stock-in?type=[daily,weekly,monthly,yearly]&date=YYYY-MM-DD
  async stockIn(req, res) {
    try {
      const owner_id = req.owner.owner_id;

      this.validateOwner(owner_id);//validate owner

      let { type, date } = req.query;

      type = type?.trim().toLowerCase();
      date = date?.trim();

      this.validateReportType(type);//validate report type
 
      const reportDate = this.validateDate(date); //validate date

      //fetch stock-in report
      const data = await reportService.stockInReport(
        owner_id,
        type,
        reportDate
      );

  
      res.json({ success: true, data });
    } catch (err) {
      return fail(res, 500, "SERVER_ERROR", err.message);
    }
  }

  // Stock-Out Report
  // GET /api/reports/stock-out?type=[daily,weekly,monthly,yearly]&date=YYYY-MM-DD
  async stockOut(req, res, next) {
    try {
      const owner_id = req.owner.owner_id;

      this.validateOwner(owner_id);//validate owner

      let { type, date } = req.query;

      type = type?.trim().toLowerCase();
      date = date?.trim();

      this.validateReportType(type);//validate report type
 
      const reportDate = this.validateDate(date); //validate date

      //fetch stock-out report
      const data = await reportService.stockOutReport(
        owner_id,
        type,
        reportDate
      );

      res.json({ success: true, data });
    } catch (err) {
      return fail(res, 500, "SERVER_ERROR", err.message);
    }
  }

  // Combined Report
  // GET /api/reports/combined?type=[daily,weekly,monthly,yearly]&date=YYYY-MM-DD
  async combined(req, res) {
    try {
      const owner_id = req.owner.owner_id;

      this.validateOwner(owner_id);//validate owner

      let { type, date } = req.query;

      type = type?.trim().toLowerCase();
      date = date?.trim();

      this.validateReportType(type);//validate report type
 
      const reportDate = this.validateDate(date); //validate date

      //fetch stock-in/out report
      const data = await reportService.stockInReport(
        owner_id,
        type,
        reportDate
      );

      res.json({ success: true, data });
    } catch (err) {
      return fail(res, 500, "SERVER_ERROR", err.message);
    }
  }
}

module.exports = new HardwareReportController();
