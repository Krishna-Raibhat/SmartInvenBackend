const prisma = require("../prisma/client");

class HardwareReportService {
  // Helper: Build date range

  getDateRange(type, date = new Date()) {
    const start = new Date(date);
    const end = new Date(date);

    switch (type) {
      case "daily":
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;

      case "weekly": {
        // Sun–Sat
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
  }

  //get stock-in records
  async stockIn(owner_id, startDate, endDate) {
    return await prisma.hardwareStockLot.findMany({
      where: {
        owner_id,
        created_at: { gte: startDate, lte: endDate }, //records between start and end date
      },
      include: {
        product: { select: { product_name: true } },
        supplier: { select: { supplier_name: true } },
      },
      orderBy: { created_at: "asc" },
    });
  }

  //get stock-out records
  async stockOut(owner_id, startDate, endDate) {
    return await prisma.hardwareStockOut.findMany({
      where: {
        owner_id,
        created_at: { gte: startDate, lte: endDate }, //records between start and end date
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
  }
  // Stock-In Report
  async stockInReport(owner_id, type, date) {
    const { start, end } = this.getDateRange(type, date);

    let totalQtyIn = 0;
    let totalStockInValue = 0;

    //get all stock-in records
    const stockIn = await this.stockIn(owner_id, start, end);

    //calculate totals
    for (const lot of stockIn) {
      totalQtyIn += lot.qty_in;
      totalStockInValue += Number(lot.cp) * lot.qty_in;
    }

    //return report data
    return {
      period: { type, start, end },
      stock_in: stockIn,
      summary: {
        total_qty_in: totalQtyIn,
        total_stock_in_value: totalStockInValue,
      },
    };
  }

  // Stock-Out Report
  async stockOutReport(owner_id, type, date) {
    const { start, end } = this.getDateRange(type, date);

    let totalQtyOut = 0;
    let totalSalesAmt = 0;

    //get all stock-out records
    const stock_out = await this.stockOut(owner_id, start, end);

    //calculate totals
    for (const out of stock_out) {
      for (const item of out.items) {
        totalQtyOut += item.qty;
        totalSalesAmt += item.line_total;
      }
    }

    //return report data
    return {
      period: { type, start, end },
      stock_out: stock_out,
      summary: {
        total_qty_out: totalQtyOut,
        total_sales_amount: totalSalesAmt,
      },
    };
  }

  // Combined Report (Stock-In + Stock-Out + Summary)

  async combinedReport(owner_id, type, date) {
    const { start, end } = this.getDateRange(type, date);

    //Stock In
    const stockIn = await this.stockIn(owner_id, start, end);

    //Stock Out
    const stockOut = await this.stockOut(owner_id, start, end);

    // Summary Calculations
    let totalQtyIn = 0;
    let totalStockInValue = 0;
    let totalSales = 0;
    let totalProfit = 0;

    for (const lot of stockIn) {
      totalQtyIn += lot.qty_in;
      totalStockInValue += Number(lot.cp) * lot.qty_in;
    }

    for (const out of stockOut) {
      for (const item of out.items) {
        totalSales += item.line_total;
        totalProfit += (Number(item.sp) - Number(item.cp)) * item.qty;
      }
    }

    return {
      period: { type, start, end },
      stock_in: stockIn,
      stock_out: stockOut,
      summary: {
        total_qty_in: totalQtyIn,
        total_stock_in_value: totalStockInValue,
        total_sales: totalSales,
        total_profit: totalProfit,
      },
    };
  }
}

module.exports = new HardwareReportService();
