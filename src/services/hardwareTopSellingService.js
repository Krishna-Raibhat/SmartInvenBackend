const prisma = require("../prisma/client");

class HardwareTopSellingService {
  async getTopSellingProducts( owner_id, start_date ) {
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

   

    // End date = start + 29 days const
    const end = new Date(start_date);
    end.setDate(end.getDate() + 29);


    const topProducts = await prisma.hardwareStockOutItem.groupBy({
      by: ["product_id"],
      where: { owner_id, created_at: { gte: start_date, lte: end } },
      _sum: { qty: true },
      orderBy: { _sum: { qty: "desc" } },
      take: 3,
    });
    return {
      from: start_date,
      to: end,
      top_products: topProducts.map((p) => ({
        product_id: p.product_id,
        total_qty_sold: p._sum.qty,
      })),
    };
  }
}
module.exports = new HardwareTopSellingService();
