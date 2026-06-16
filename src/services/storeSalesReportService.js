import { prisma } from "../prisma/client.js";

class StoreSalesReportService {
  async salesByService(owner_id, { from, to } = {}) {
    // Build date filter on StoreSales.created_at
    const dateFilter = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const salesWhere = {
      owner_id,
      ...(Object.keys(dateFilter).length && { created_at: dateFilter }),
    };

    // Pull all sales items for service-type products in date range
    const items = await prisma.storeSalesItem.findMany({
      where: {
        owner_id,
        sales: salesWhere,
        product: { type: "service" },
      },
      select: {
        qty: true,
        line_total: true,
        product: {
          select: {
            product_name: true,
            category: { select: { category_id: true, category_name: true } },
          },
        },
      },
    });

    // Group by category
    const categoryMap = new Map();
    // "Uncategorized" bucket for services with no category
    const UNCAT = { category_id: null, category_name: "Others" };

    let grandTotal = 0;
    let grandBookings = 0;

    for (const item of items) {
      const cat = item.product.category ?? UNCAT;
      const key = cat.category_id ?? "__uncat__";

      if (!categoryMap.has(key)) {
        categoryMap.set(key, {
          category_id: cat.category_id,
          category_name: cat.category_name,
          total_sales: 0,
          total_bookings: 0,
        });
      }

      const entry = categoryMap.get(key);
      const lineTotal = Number(item.line_total);
      entry.total_sales += lineTotal;
      entry.total_bookings += item.qty;

      grandTotal += lineTotal;
      grandBookings += item.qty;
    }

    // Build sorted array (desc by total_sales), inject share %
    const categories = [...categoryMap.values()]
      .sort((a, b) => b.total_sales - a.total_sales)
      .map((cat) => ({
        ...cat,
        total_sales: Number(cat.total_sales.toFixed(2)),
        share_percent:
          grandTotal > 0
            ? Number(((cat.total_sales / grandTotal) * 100).toFixed(1))
            : 0,
      }));

    // Daily trend (for the line chart) — group by date
    const trendMap = new Map();
    const trendItems = await prisma.storeSalesItem.findMany({
      where: {
        owner_id,
        sales: salesWhere,
        product: { type: "service" },
      },
      select: {
        line_total: true,
        sales: { select: { created_at: true } },
      },
    });

    for (const item of trendItems) {
      const day = item.sales.created_at.toISOString().slice(0, 10); // "YYYY-MM-DD"
      trendMap.set(day, (trendMap.get(day) ?? 0) + Number(item.line_total));
    }

    const trend = [...trendMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date, total: Number(total.toFixed(2)) }));

    return {
      summary: {
        total_service_sales: Number(grandTotal.toFixed(2)),
        total_bookings: grandBookings,
      },
      categories,
      trend,
    };
  }
}

export default new StoreSalesReportService();