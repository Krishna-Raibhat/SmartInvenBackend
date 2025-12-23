const prisma = require("../prisma/client");

class HardwareReportService {
  // Helper: Build date range
  getDateRange(type, date = new Date()) {
    try {
      const start = new Date(date);
      const end = new Date(date);

      switch (type) {
        case "daily":
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          break;

        case "weekly": {
          const day = start.getDay(); // 0 = Sunday
          start.setDate(start.getDate() - day);
          start.setHours(0, 0, 0, 0);

          end.setDate(start.getDate() + 6);
          end.setHours(23, 59, 59, 999);
          break;
        }

        case "monthly":
          start.setDate(1);
          start.setHours(0, 0, 0, 0);

          end.setMonth(start.getMonth() + 1, 0);
          end.setHours(23, 59, 59, 999);
          break;

        case "yearly":
          start.setMonth(0, 1);
          start.setHours(0, 0, 0, 0);

          end.setMonth(11, 31);
          end.setHours(23, 59, 59, 999);
          break;

        default:
          const err = new Error("Invalid report type");
          err.status = 400;
          err.code = "INVALID_REPORT_TYPE";
          throw err;
      }

      return { start, end };
    } catch (err) {
      err.message = err.message || "Error building date range";
      err.status = err.status || 500;
      throw err;
    }
  }

  // Get stock-in records
  async stockIn(owner_id, startDate, endDate) {
    try {
      if (!owner_id) {
        const err = new Error("Owner ID is required for stock-in report");
        err.status = 400;
        err.code = "OWNER_ID_REQUIRED";
        throw err;
      }

      return await prisma.hardwareStockLot.findMany({
        where: {
          owner_id,
          created_at: { gte: startDate, lte: endDate },
        },
        include: {
          product: { select: { product_name: true } },
          supplier: { select: { supplier_name: true } },
        },
        orderBy: { created_at: "asc" },
      });
    } catch (err) {
      err.message = err.message || "Failed to fetch stock-in records";
      err.status = err.status || 500;
      throw err;
    }
  }

  //get stock-out records
  async stockOut(owner_id, startDate, endDate) {
    try {
      if (!owner_id) {
        const err = new Error("Owner ID is required for stock-out report");
        err.status = 400;
        err.code = "OWNER_ID_REQUIRED";
        throw err;
      }

      return await prisma.hardwareStockOut.findMany({
        where: {
          owner_id,
          created_at: { gte: startDate, lte: endDate },
        },
        include: {
          items: {
            include: {
              product: { select: { product_name: true } },
            },
          },
        },
        orderBy: { created_at: "asc" },
      });
    } catch (err) {
      err.message = err.message || "Failed to fetch stock-out records";
      err.status = err.status || 500;
      throw err;
    }
  }
  // Stock-In Report
  async stockInReport(owner_id, type, date) {
    try {
      const { start, end } = this.getDateRange(type, date);
      const stockIn = await this.stockIn(owner_id, start, end);

      let totalQtyIn = 0;
      let totalStockInValue = 0;

      for (const lot of stockIn) {
        totalQtyIn += lot.qty_in || 0;
        totalStockInValue += (Number(lot.cp) || 0) * (lot.qty_in || 0);
      }

      return {
        period: { type, start, end },
        stock_in: stockIn,
        summary: {
          total_qty_in: totalQtyIn,
          total_stock_in_value: totalStockInValue,
        },
      };
    } catch (err) {
      err.message = err.message || "Failed to generate stock-in report";
      err.status = err.status || 500;
      throw err;
    }
  }

  // Stock-Out Report
  async stockOutReport(owner_id, type, date) {
    try {
      const { start, end } = this.getDateRange(type, date);
      const stock_out = await this.stockOut(owner_id, start, end);

      

      let totalQtyOut = 0;
      let totalSalesAmt = 0;
      let totalPiad=0;

      for (const out of stock_out) {
        for (const item of out.items || []) {
          totalQtyOut += Number(item.qty) || 0;
          totalSalesAmt += Number(item.line_total) || 0;
        }
        totalPiad+=Number(out.paid_amount)||0;

      }

      return {
        period: { type, start, end },
        stock_out: stock_out,
        summary: {
          total_qty_out: totalQtyOut,
          total_sales_amount: totalSalesAmt,
          total_paid: totalPiad,
        },
      };
    } catch (err) {
      err.message = err.message || "Failed to generate stock-out report";
      err.status = err.status || 500;
      throw err;
    }
  }

  // Combined Report (Stock-In + Stock-Out + Summary)
  async combinedReport(owner_id, type, date) {
    try {
      const { start, end } = this.getDateRange(type, date);

      const stockIn = await this.stockIn(owner_id, start, end);
      const stockOut = await this.stockOut(owner_id, start, end);

      let totalQtyIn = 0;
      let totalStockInValue = 0;
      let totalSales = 0;
      let paidAmt=0;
      let totalCp=0;
      let totalQtyOut = 0;


      for (const lot of stockIn) {
        totalQtyIn += lot.qty_in || 0;
        totalStockInValue += (Number(lot.cp) || 0) * (lot.qty_in || 0);
      }

      for (const out of stockOut) {
        for (const item of out.items || []) {
          totalQtyOut += Number(item.qty) || 0;
          totalSales += Number(item.line_total) || 0;
          totalCp += (Number(item.cp) || 0) * (item.qty || 0);
        }
        paidAmt+=Number(out.paid_amount)||0;
    
      }
      const totalProfit = paidAmt - totalCp;

      return {
        period: { type, start, end },
        stock_in: stockIn,
        stock_out: stockOut,
        summary: {
          total_qty_in: totalQtyIn,
          total_stock_in_amt: totalStockInValue,
          total_qty_out: totalQtyOut,
          total_qty_out_cp: totalCp,
          total_sales_amt: totalSales,
          total_paid: paidAmt,
          total_profit: totalProfit,
        },
      };
    } catch (err) {
      err.message = err.message || "Failed to generate combined report";
      err.status = err.status || 500;
      throw err;
    }
  }
}

module.exports = new HardwareReportService();