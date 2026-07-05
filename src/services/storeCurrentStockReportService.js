// src/services/storeCurrentStockReportService.js
import { prisma } from "../prisma/client.js";

class StoreCurrentStockReportService {
  async getCurrentStock(owner_id) {
    // Run all queries in parallel for performance
    const [productsData, categoriesData] = await Promise.all([
      // Products with current stock from lots
      prisma.$queryRaw`
        SELECT
          p.product_id,
          p.product_name,
          COALESCE(c.category_name, 'Uncategorized') AS category,
          COALESCE(u.unit_name, 'pcs') AS unit,
          COALESCE(SUM(sl.qty_remaining), 0)::int AS qty_remaining,
          COALESCE(SUM(sl.qty_in), 0)::int AS qty_in,
          COUNT(DISTINCT sl.lot_id)::int AS lots,
          -- Weighted average CP and SP based on remaining quantities
          CASE 
            WHEN SUM(sl.qty_remaining) > 0 
            THEN (SUM(sl.cp * sl.qty_remaining) / SUM(sl.qty_remaining))::numeric
            ELSE 0
          END AS cp,
          CASE 
            WHEN SUM(sl.qty_remaining) > 0 
            THEN (SUM(sl.sp * sl.qty_remaining) / SUM(sl.qty_remaining))::numeric
            ELSE 0
          END AS sp
        FROM store_products p
        LEFT JOIN store_stock_lots sl ON sl.product_id = p.product_id AND sl.owner_id = ${owner_id}
        LEFT JOIN store_categories c ON c.category_id = p.category_id
        LEFT JOIN store_units u ON u.unit_id = p.unit_id
        WHERE p.owner_id = ${owner_id}
          AND p.type = 'item'
        GROUP BY p.product_id, p.product_name, c.category_name, u.unit_name
        HAVING SUM(sl.qty_remaining) > 0
        ORDER BY p.product_name ASC
      `,

      // Category summary
      prisma.$queryRaw`
        SELECT
          COALESCE(c.category_name, 'Uncategorized') AS name,
          SUM(sl.qty_remaining)::int AS qty,
          SUM(sl.cp * sl.qty_remaining)::numeric AS value
        FROM store_stock_lots sl
        JOIN store_products p ON p.product_id = sl.product_id
        LEFT JOIN store_categories c ON c.category_id = p.category_id
        WHERE sl.owner_id = ${owner_id}
          AND p.type = 'item'
          AND sl.qty_remaining > 0
        GROUP BY c.category_name
        ORDER BY value DESC
      `
    ]);

    // Calculate category percentages
    const totalCategoryValue = categoriesData.reduce((sum, cat) => sum + Number(cat.value), 0);
    const categories = categoriesData.map(cat => ({
      name: cat.name,
      qty: Number(cat.qty),
      value: Number(Number(cat.value).toFixed(2)),
      pct: totalCategoryValue > 0 
        ? Number(((Number(cat.value) / totalCategoryValue) * 100).toFixed(1))
        : 0
    }));

    // Format products
    const products = productsData.map(p => ({
      product_id: p.product_id,
      product_name: p.product_name,
      category: p.category,
      unit: p.unit,
      cp: Number(Number(p.cp).toFixed(2)),
      sp: Number(Number(p.sp).toFixed(2)),
      qty_remaining: Number(p.qty_remaining),
      qty_in: Number(p.qty_in),
      lots: Number(p.lots),
    }));

    // Calculate summary
    const total_products = products.length;
    const total_qty = products.reduce((sum, p) => sum + p.qty_remaining, 0);
    const total_stock_value = products.reduce((sum, p) => sum + (p.cp * p.qty_remaining), 0);
    const total_sell_value = products.reduce((sum, p) => sum + (p.sp * p.qty_remaining), 0);
    const avg_margin = total_sell_value > 0
      ? ((total_sell_value - total_stock_value) / total_sell_value) * 100
      : 0;

    const summary = {
      total_products,
      total_qty,
      total_stock_value: Number(total_stock_value.toFixed(2)),
      total_sell_value: Number(total_sell_value.toFixed(2)),
      avg_margin: Number(avg_margin.toFixed(1)),
      categories: categories.length,
    };

    return {
      success: true,
      data: {
        summary,
        products,
        categories,
      }
    };
  }
}

export default new StoreCurrentStockReportService();
