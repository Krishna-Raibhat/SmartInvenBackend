// src/services/storeStockAlertService.js
import { prisma } from "../prisma/client.js";

class StoreStockAlertService {
  async getStockAlerts(owner_id, { lowThreshold = 10, criticalThreshold = 5 }) {
    const [lowStockProducts, outOfStockProducts, lowStockLots, outOfStockLots] = await Promise.all([
      // Low stock products (qty_remaining > 0 but <= lowThreshold)
      prisma.$queryRaw`
        SELECT
          p.product_id,
          p.product_name,
          COALESCE(c.category_name, 'Uncategorized') AS category,
          COALESCE(u.unit_name, 'pcs') AS unit,
          COALESCE(SUM(sl.qty_remaining), 0)::int AS qty_remaining,
          COALESCE(SUM(sl.qty_in), 0)::int AS qty_in,
          COUNT(DISTINCT sl.lot_id)::int AS lots,
          -- Weighted average CP and SP
          CASE 
            WHEN SUM(sl.qty_remaining) > 0 
            THEN (SUM(sl.cp * sl.qty_remaining) / SUM(sl.qty_remaining))::numeric
            ELSE 0
          END AS cp,
          CASE 
            WHEN SUM(sl.qty_remaining) > 0 
            THEN (SUM(sl.sp * sl.qty_remaining) / SUM(sl.qty_remaining))::numeric
            ELSE 0
          END AS sp,
          -- Last purchase date
          MAX(sl.created_at) AS last_purchase_date,
          -- Get the most recent supplier
          (
            SELECT s.supplier_name
            FROM store_stock_lots sl2
            JOIN store_suppliers s ON s.supplier_id = sl2.supplier_id
            WHERE sl2.product_id = p.product_id 
              AND sl2.owner_id = ${owner_id}
            ORDER BY sl2.created_at DESC
            LIMIT 1
          ) AS supplier
        FROM store_products p
        LEFT JOIN store_stock_lots sl ON sl.product_id = p.product_id AND sl.owner_id = ${owner_id}
        LEFT JOIN store_categories c ON c.category_id = p.category_id
        LEFT JOIN store_units u ON u.unit_id = p.unit_id
        WHERE p.owner_id = ${owner_id}
          AND p.type = 'item'
        GROUP BY p.product_id, p.product_name, c.category_name, u.unit_name
        HAVING SUM(sl.qty_remaining) > 0 
          AND SUM(sl.qty_remaining) <= ${lowThreshold}
        ORDER BY qty_remaining ASC, p.product_name ASC
      `,

      // Out of stock products (qty_remaining = 0 or no stock lots)
      prisma.$queryRaw`
        SELECT
          p.product_id,
          p.product_name,
          COALESCE(c.category_name, 'Uncategorized') AS category,
          COALESCE(u.unit_name, 'pcs') AS unit,
          COALESCE(SUM(sl.qty_in), 0)::int AS total_purchased,
          -- Last purchase info
          MAX(sl.created_at) AS last_purchase_date,
          (
            SELECT AVG(sl2.sp)::numeric
            FROM store_stock_lots sl2
            WHERE sl2.product_id = p.product_id 
              AND sl2.owner_id = ${owner_id}
          ) AS avg_sp,
          (
            SELECT AVG(sl2.cp)::numeric
            FROM store_stock_lots sl2
            WHERE sl2.product_id = p.product_id 
              AND sl2.owner_id = ${owner_id}
          ) AS avg_cp,
          -- Get the most recent supplier
          (
            SELECT s.supplier_name
            FROM store_stock_lots sl2
            JOIN store_suppliers s ON s.supplier_id = sl2.supplier_id
            WHERE sl2.product_id = p.product_id 
              AND sl2.owner_id = ${owner_id}
            ORDER BY sl2.created_at DESC
            LIMIT 1
          ) AS supplier
        FROM store_products p
        LEFT JOIN store_stock_lots sl ON sl.product_id = p.product_id AND sl.owner_id = ${owner_id}
        LEFT JOIN store_categories c ON c.category_id = p.category_id
        LEFT JOIN store_units u ON u.unit_id = p.unit_id
        WHERE p.owner_id = ${owner_id}
          AND p.type = 'item'
        GROUP BY p.product_id, p.product_name, c.category_name, u.unit_name
        HAVING COALESCE(SUM(sl.qty_remaining), 0) = 0
        ORDER BY last_purchase_date DESC NULLS LAST, p.product_name ASC
      `,

      // Get detailed lot information for low stock products
      prisma.$queryRaw`
        WITH low_stock_products AS (
          SELECT p.product_id
          FROM store_products p
          LEFT JOIN store_stock_lots sl ON sl.product_id = p.product_id AND sl.owner_id = ${owner_id}
          WHERE p.owner_id = ${owner_id} AND p.type = 'item'
          GROUP BY p.product_id
          HAVING SUM(sl.qty_remaining) > 0 AND SUM(sl.qty_remaining) <= ${lowThreshold}
        )
        SELECT
          sl.lot_id,
          sl.product_id,
          s.supplier_name,
          sl.cp,
          sl.sp,
          sl.qty_in,
          sl.qty_remaining,
          sl.created_at AS date,
          sl.notes
        FROM store_stock_lots sl
        JOIN low_stock_products lsp ON lsp.product_id = sl.product_id
        LEFT JOIN store_suppliers s ON s.supplier_id = sl.supplier_id
        WHERE sl.owner_id = ${owner_id}
        ORDER BY sl.product_id, sl.created_at DESC
      `,

      // Get detailed lot information for out of stock products
      prisma.$queryRaw`
        WITH out_of_stock_products AS (
          SELECT p.product_id
          FROM store_products p
          LEFT JOIN store_stock_lots sl ON sl.product_id = p.product_id AND sl.owner_id = ${owner_id}
          WHERE p.owner_id = ${owner_id} AND p.type = 'item'
          GROUP BY p.product_id
          HAVING COALESCE(SUM(sl.qty_remaining), 0) = 0
        )
        SELECT
          sl.lot_id,
          sl.product_id,
          s.supplier_name,
          sl.cp,
          sl.sp,
          sl.qty_in,
          sl.qty_remaining,
          sl.created_at AS date,
          sl.notes
        FROM store_stock_lots sl
        JOIN out_of_stock_products oos ON oos.product_id = sl.product_id
        LEFT JOIN store_suppliers s ON s.supplier_id = sl.supplier_id
        WHERE sl.owner_id = ${owner_id}
        ORDER BY sl.product_id, sl.created_at DESC
      `
    ]);

    // Group lots by product_id
    const lowStockLotsMap = {};
    for (const lot of lowStockLots) {
      if (!lowStockLotsMap[lot.product_id]) {
        lowStockLotsMap[lot.product_id] = [];
      }
      lowStockLotsMap[lot.product_id].push({
        lot_id: lot.lot_id,
        supplier: lot.supplier_name || 'N/A',
        cp: Number(Number(lot.cp).toFixed(2)),
        sp: Number(Number(lot.sp).toFixed(2)),
        qty_in: Number(lot.qty_in),
        qty_remaining: Number(lot.qty_remaining),
        date: lot.date,
        notes: lot.notes,
      });
    }

    const outOfStockLotsMap = {};
    for (const lot of outOfStockLots) {
      if (!outOfStockLotsMap[lot.product_id]) {
        outOfStockLotsMap[lot.product_id] = [];
      }
      outOfStockLotsMap[lot.product_id].push({
        lot_id: lot.lot_id,
        supplier: lot.supplier_name || 'N/A',
        cp: Number(Number(lot.cp).toFixed(2)),
        sp: Number(Number(lot.sp).toFixed(2)),
        qty_in: Number(lot.qty_in),
        qty_remaining: Number(lot.qty_remaining),
        date: lot.date,
        notes: lot.notes,
      });
    }

    // Format low stock products
    const lowStock = lowStockProducts.map(p => {
      const qtyRemaining = Number(p.qty_remaining);
      const qtyIn = Number(p.qty_in);
      const level = qtyRemaining <= criticalThreshold ? 'critical' : 'low';
      const productId = p.product_id;
      
      return {
        product_id: productId,
        product_name: p.product_name,
        category: p.category,
        unit: p.unit,
        qty_remaining: qtyRemaining,
        qty_in: qtyIn,
        lots: Number(p.lots),
        cp: Number(Number(p.cp).toFixed(2)),
        sp: Number(Number(p.sp).toFixed(2)),
        stock_value: Number((Number(p.cp) * qtyRemaining).toFixed(2)),
        level,
        coverage_percent: qtyIn > 0 ? Number(((qtyRemaining / qtyIn) * 100).toFixed(1)) : 0,
        last_purchase_date: p.last_purchase_date,
        supplier: p.supplier || 'N/A',
        lot_list: lowStockLotsMap[productId] || [],
      };
    });

    // Format out of stock products
    const outOfStock = outOfStockProducts.map(p => {
      const productId = p.product_id;
      return {
        product_id: productId,
        product_name: p.product_name,
        category: p.category,
        unit: p.unit,
        total_purchased: Number(p.total_purchased),
        avg_cp: p.avg_cp ? Number(Number(p.avg_cp).toFixed(2)) : 0,
        avg_sp: p.avg_sp ? Number(Number(p.avg_sp).toFixed(2)) : 0,
        last_purchase_date: p.last_purchase_date,
        days_since_purchase: p.last_purchase_date 
          ? Math.floor((new Date() - new Date(p.last_purchase_date)) / (1000 * 60 * 60 * 24))
          : null,
        supplier: p.supplier || 'N/A',
        lot_list: outOfStockLotsMap[productId] || [],
      };
    });

    // Calculate summary
    const summary = {
      low_stock_count: lowStock.filter(p => p.level === 'low').length,
      critical_stock_count: lowStock.filter(p => p.level === 'critical').length,
      out_of_stock_count: outOfStock.length,
      total_low_stock_value: Number(
        lowStock.reduce((sum, p) => sum + p.stock_value, 0).toFixed(2)
      ),
      total_alerts: lowStock.length + outOfStock.length,
    };

    return {
      success: true,
      data: {
        summary,
        low_stock: lowStock,
        out_of_stock: outOfStock,
      }
    };
  }
}

export default new StoreStockAlertService();
