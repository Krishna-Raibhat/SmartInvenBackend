const {prisma}  = require("../prisma/client");

class HardwareTopSellingService {
  async getTopSellingProducts(owner_id, start_date) {
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

    // ✅ Normalize start date (start of day)
    const start = new Date(start_date);
    start.setHours(0, 0, 0, 0);

    // ✅ Normalize end date (30-day window)
    const end = new Date(start);
    end.setDate(end.getDate() + 29);
    end.setHours(23, 59, 59, 999);

    // 🔹 Step 1: Get top selling product IDs
    const grouped = await prisma.hardwareStockOutItem.groupBy({
      by: ["product_id"],
      where: {
        owner_id,
        created_at: {
          gte: start,
          lte: end,
        },
      },
      _sum: { qty: true },
      orderBy: {
        _sum: { qty: "desc" },
      },
      take: 3,
    });

    if (grouped.length === 0) {
      return {
        from: start,
        to: end,
        top_products: [],
      };
    }

    // 🔹 Step 2: Fetch product names in ONE query
    const products = await prisma.hardwareProduct.findMany({
      where: {
        owner_id,
        product_id: {
          in: grouped.map((g) => g.product_id),
        },
      },
      select: {
        product_id: true,
        product_name: true,
      },
    });

    const productNameMap = Object.fromEntries(
      products.map((p) => [p.product_id, p.product_name])
    );

    // 🔹 Step 3: Merge quantity + product name
    const topProducts = grouped.map((g) => ({
      product_id: g.product_id,
      product_name: productNameMap[g.product_id] ?? "Unknown Product",
      total_qty_sold: Number(g._sum.qty || 0),
    }));

    return {
      from: start,
      to: end,
      top_products: topProducts,
    };
  }
}

module.exports = new HardwareTopSellingService();