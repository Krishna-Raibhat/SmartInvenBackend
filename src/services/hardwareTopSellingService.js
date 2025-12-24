const prisma = require("../prisma/client");

class HardwareTopSellingService {
  async getTopSellingProducts({ owner_id, start_date }) {
    if (!owner_id) {
      const err = new Error("Owner not authenticated");
      err.status = 401;
      err.code = "OWNER_NOT_AUTHENTICATED";
      throw err;
    }

    if (!start_date) {
      const err = new Error("start_date is required");
      err.status = 400;
      err.code = "START_DATE_REQUIRED";
      throw err;
    }

    // Parse the start_date string into year, month, day
    const [year, month, day] = start_date.split("-").map(Number);

    // Create start and end dates in LOCAL time
    const start = new Date(year, month - 1, day); // LOCAL midnight

    // End date = start + 29 days
    const end = new Date(start);
    end.setDate(end.getDate() + 29);
    end.setHours(23, 59, 59, 999);      // local end of the 30th day

    // Query top 3 selling products within the date range
    const topProducts = await prisma.hardwareStockOutItem.groupBy({
      by: ["product_id"],
      where: {
        owner_id,
        created_at: {
          gte: start,
          lte: end,
        },
      },
      _sum: {
        qty: true,
      },
      orderBy: {
        _sum: {
          qty: "desc",
        },
      },
      take: 3,
    });


    // Helper to format local date as YYYY-MM-DD
    function formatLocalDate(date) {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }

    return {
      from: formatLocalDate(start),
      to: formatLocalDate(end),
      top_products: topProducts.map(p => ({
        product_id: p.product_id,
        total_qty_sold: p._sum.qty,
      })),
    };
  }
}

module.exports = new HardwareTopSellingService();
