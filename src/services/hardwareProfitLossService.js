// Import Prisma client to interact with the database
import { prisma } from "../prisma/client.js";

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

      // const start = new Date(start_date);
      // const end = new Date(end_date);
      const start = new Date(start_date);
      start.setHours(0, 0, 0, 0);

      const end = new Date(end_date);
      end.setHours(23, 59, 59, 999);

      if (start > end) {
        const err = new Error("Start date cannot be after end date");
        err.status = 400;
        throw err;
      }

      // Fetch stockout headers(paid_amount)
      // WITH this:
      const stockouts = await prisma.hardwareStockOut.findMany({
        where: {
          owner_id,
          payment_status: "paid", // ✅ only fully paid
          created_at: { gte: start, lte: end },
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
export default new HardwareProfitService();
