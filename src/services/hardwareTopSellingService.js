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

    // Parse start date
    const start = new Date(start_date);
    start.setHours(0, 0, 0, 0);

    // End date = start + 29 days const
    end = new Date(start);
    end.setDate(end.getDate() + 29);
    end.setHours(23, 59, 59, 999);

    const topProducts = await prisma.hardwareStockOutItem.groupBy({
      by: ["product_id"],
      where: { owner_id, created_at: { gte: start, lte: end } },
      _sum: { qty: true },
      orderBy: { _sum: { qty: "desc" } },
      take: 3,
    });
    return {
      from: start,
      to: end,
      top_products: topProducts.map((p) => ({
        product_id: p.product_id,
        total_qty_sold: p._sum.qty,
      })),
    };
  }
}
module.exports = new HardwareTopSellingService();
