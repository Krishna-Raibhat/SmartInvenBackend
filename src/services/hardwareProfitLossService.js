// Import Prisma client to interact with the database
const {prisma}  = require("../prisma/client");

/* Helper function to calculate date range based on type
function getDateRange(type) {
  // Validate type early
  if (!type) {
    const err = new Error("Type is required");
    err.status = 400;
    err.code = "TYPE_REQUIRED";
    throw err;
  }

  // Current date and time
  const now = new Date();

  // Variables to store start and end dates
  let start;
  let end;

  // Decide date range based on requested period
  switch (type) {
    case "daily":
      // Start of today
      start = new Date(now);
      start.setHours(0, 0, 0, 0);

      // End of today
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
      break;

    case "weekly":
      // JavaScript getDay(): 0 = Sunday
      const dayOfWeek = now.getDay();

      // Sunday of current week
      start = new Date(now);
      start.setDate(now.getDate() - dayOfWeek);
      start.setHours(0, 0, 0, 0);

      // Saturday of current week
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;

    case "monthly":
      // First day of current month
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);

      // Last day of current month
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;

    case "yearly":
      // First day of current year
      start = new Date(now.getFullYear(), 0, 1);
      start.setHours(0, 0, 0, 0);

      // Last day of current year
      end = new Date(now.getFullYear(), 11, 31);
      end.setHours(23, 59, 59, 999);
      break;

    default:
      // Invalid type error
      const err = new Error(
        "Invalid type. Use daily, weekly, monthly, or yearly."
      );
      err.status = 400;
      err.code = "INVALID_TYPE";
      throw err;
  }

  // Return date range
  return { start, end };
}*/

// Service class for profit and loss calculation
class HardwareProfitService {
  // Calculate profit or loss
  async getProfitLoss({ owner_id, start_date, end_date }) {
    // Validate owner_id
    if (!owner_id) {
      const err = new Error("Owner not authenticated");
      err.status = 401;
      err.code = "OWNER_NOT_AUTHENTICATED";
      throw err;
    }

    try {
      // Validate dates
      if (!start_date || !end_date) {
        const err = new Error("Start date and end date are required");
        err.status = 400;
        throw err;
      }

      const start = new Date(start_date);
      const end = new Date(end_date);


      if (start > end) {
        const err = new Error("Start date cannot be after end date");
        err.status = 400;
        throw err;
      }

      // Fetch stockout headers(paid_amount)
      const stockouts = await prisma.hardwareStockOut.findMany({
        where: {
          owner_id,
          created_at: {
            gte: start,
            lte: end,
          },
        },
        select: {
          stockout_id: true,
          paid_amount: true,
        },
      });

      if (stockouts.length === 0) {
        return {
          from: start,
          to: end,
          total_paid: 0,
          total_cost: 0,
          profit_or_loss: 0,
          status: "profit",
        };
      }

      const stockoutIds = stockouts.map((s) => s.stockout_id);

      // Fetch sold items for owner within date range
      const items = await prisma.hardwareStockOutItem.findMany({
        where: {
          owner_id,
          stockout_id:{in: stockoutIds},
          created_at: {
            gte: start, // greater than or equals to start
            lte: end, // less than or equals to end
          },
        },
        select: {
          qty: true,
          cp: true,
          sp: true,
        },
      });

      // Initialize totals
      let totalSales = 0;
      let totalCost = 0;
      let totalPaid = 0;

      // Calculate totals
      for (const item of items) {
        const cost = Number(item.cp) * item.qty;
        const sales = Number(item.sp) * item.qty;

        totalCost += cost;
        totalSales += sales;
      }

      for (const stock of stockouts){
        totalPaid += Number(stock.paid_amount || 0);
      }

      const totalProfit = totalPaid - totalCost;

      // Return profit/loss response
      return {
        from: start,
        to: end,
        total_sales_amount: totalSales,
        total_cost_amount: totalCost,
        total_paid_amount: totalPaid,
        profit_or_loss_amount: totalProfit,
        status: totalProfit >= 0 ? "profit" : "loss",
      };
    } catch (error) {
      // Handle Prisma errors gracefully
      if (error.name === "PrismaClientKnownRequestError") {
        const err = new Error("Database error occurred");
        err.status = 500;
        err.code = "DATABASE_ERROR";
        throw err;
      }

      // Re-throw already structured errors
      throw error;
    }
  }
}

// Export service instance
module.exports = new HardwareProfitService();
