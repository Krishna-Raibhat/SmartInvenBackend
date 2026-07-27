// src/services/storeSalesItemReportService.js

import { prisma } from "../prisma/client.js";

class StoreSalesItemReportService {
  async salesByItem(owner_id, { from, to } = {}) {
    const now = new Date();

    // Default to the current month so an omitted filter never loads all-time data.
    const startDate = from
      ? new Date(`${from}T00:00:00.000Z`)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    // Use an exclusive end boundary: the day after `to` at 00:00 UTC.
    const endDate = to
      ? (() => {
          const date = new Date(`${to}T00:00:00.000Z`);
          date.setUTCDate(date.getUTCDate() + 1);
          return date;
        })()
      : new Date(
          Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate() + 1,
          ),
        );

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime())
    ) {
      throw new Error("Invalid report date range");
    }

    if (startDate >= endDate) {
      throw new Error("The from date must be before or equal to the to date");
    }

    const [
      summaryRows,
      categoryRows,
      productRows,
      supplierRows,
      trendRows,
      returnRows,
      lowStockRows,
    ] = await Promise.all([
      // ============================================================
      // SUMMARY
      //
      // Total item sales = selling price × quantity sold.
      // Discounts, returns and refunds do not reduce this value.
      //
      // Profit = total item sales - original sold-item COGS.
      // Expenses, returns and refunds do not reduce this value.
      // ============================================================
      prisma.$queryRaw`
        SELECT
          COALESCE(
            SUM(COALESCE(ssi.sp, 0) * ssi.qty),
            0
          )::numeric AS total_sales,

          COALESCE(
            SUM(COALESCE(ssi.cp, 0) * ssi.qty),
            0
          )::numeric AS total_cogs,

          COALESCE(
            SUM(ssi.qty),
            0
          )::int AS total_units

        FROM store_sales_items ssi

        JOIN store_sales ss
          ON ss.sales_id = ssi.sales_id

        JOIN store_products p
          ON p.product_id = ssi.product_id

        WHERE ss.owner_id = ${owner_id}
          AND p.owner_id = ${owner_id}
          AND p.type = 'item'
          AND ss.created_at >= ${startDate}
          AND ss.created_at < ${endDate}
      `,

      // ============================================================
      // SALES BY CATEGORY
      //
      // Uses SP × sold quantity only.
      // Discounts and returns are intentionally ignored.
      // ============================================================
      prisma.$queryRaw`
        SELECT
          COALESCE(
            c.category_id::text,
            '__uncategorized__'
          ) AS category_id,

          COALESCE(
            c.category_name,
            'Uncategorized'
          ) AS category_name,

          COALESCE(
            SUM(COALESCE(ssi.sp, 0) * ssi.qty),
            0
          )::numeric AS total_sales,

          COALESCE(
            SUM(ssi.qty),
            0
          )::int AS total_units

        FROM store_sales_items ssi

        JOIN store_sales ss
          ON ss.sales_id = ssi.sales_id

        JOIN store_products p
          ON p.product_id = ssi.product_id

        LEFT JOIN store_categories c
          ON c.category_id = p.category_id

        WHERE ss.owner_id = ${owner_id}
          AND p.owner_id = ${owner_id}
          AND p.type = 'item'
          AND ss.created_at >= ${startDate}
          AND ss.created_at < ${endDate}

        GROUP BY
          c.category_id,
          c.category_name

        HAVING SUM(COALESCE(ssi.sp, 0) * ssi.qty) > 0

        ORDER BY total_sales DESC
      `,

      // ============================================================
      // TOP PRODUCTS
      //
      // Sales = SP × sold quantity.
      // Profit = sales - original sold-item COGS.
      // Discounts, returns, refunds and expenses are ignored.
      // ============================================================
      prisma.$queryRaw`
        SELECT
          p.product_id,
          p.product_name,

          COALESCE(
            c.category_name,
            'Uncategorized'
          ) AS category_name,

          COALESCE(
            SUM(COALESCE(ssi.sp, 0) * ssi.qty),
            0
          )::numeric AS total_sales,

          COALESCE(
            SUM(ssi.qty),
            0
          )::int AS total_units,

          COALESCE(
            SUM(COALESCE(ssi.cp, 0) * ssi.qty),
            0
          )::numeric AS total_cogs

        FROM store_sales_items ssi

        JOIN store_sales ss
          ON ss.sales_id = ssi.sales_id

        JOIN store_products p
          ON p.product_id = ssi.product_id

        LEFT JOIN store_categories c
          ON c.category_id = p.category_id

        WHERE ss.owner_id = ${owner_id}
          AND p.owner_id = ${owner_id}
          AND p.type = 'item'
          AND ss.created_at >= ${startDate}
          AND ss.created_at < ${endDate}

        GROUP BY
          p.product_id,
          p.product_name,
          c.category_name

        HAVING SUM(COALESCE(ssi.sp, 0) * ssi.qty) > 0

        ORDER BY total_sales DESC

        LIMIT 10
      `,

      // ============================================================
      // SALES BY SUPPLIER
      //
      // Uses SP × sold quantity only.
      // ============================================================
      prisma.$queryRaw`
        SELECT
          sup.supplier_id,
          sup.supplier_name,

          COALESCE(
            SUM(COALESCE(ssi.sp, 0) * ssi.qty),
            0
          )::numeric AS total_sales,

          COALESCE(
            SUM(ssi.qty),
            0
          )::int AS total_units

        FROM store_sales_items ssi

        JOIN store_sales ss
          ON ss.sales_id = ssi.sales_id

        JOIN store_products p
          ON p.product_id = ssi.product_id

        JOIN store_stock_lots sl
          ON sl.lot_id = ssi.lot_id

        JOIN store_suppliers sup
          ON sup.supplier_id = sl.supplier_id

        WHERE ss.owner_id = ${owner_id}
          AND p.owner_id = ${owner_id}
          AND sl.owner_id = ${owner_id}
          AND p.type = 'item'
          AND ss.created_at >= ${startDate}
          AND ss.created_at < ${endDate}

        GROUP BY
          sup.supplier_id,
          sup.supplier_name

        ORDER BY total_sales DESC
      `,

      // ============================================================
      // DAILY ITEM SALES TREND
      //
      // Uses SP × sold quantity only.
      // Returns and refunds do not reduce historical sales.
      // ============================================================
      prisma.$queryRaw`
        SELECT
          DATE(ss.created_at)::text AS date,

          COALESCE(
            SUM(COALESCE(ssi.sp, 0) * ssi.qty),
            0
          )::numeric AS total

        FROM store_sales_items ssi

        JOIN store_sales ss
          ON ss.sales_id = ssi.sales_id

        JOIN store_products p
          ON p.product_id = ssi.product_id

        WHERE ss.owner_id = ${owner_id}
          AND p.owner_id = ${owner_id}
          AND p.type = 'item'
          AND ss.created_at >= ${startDate}
          AND ss.created_at < ${endDate}

        GROUP BY DATE(ss.created_at)

        ORDER BY DATE(ss.created_at) ASC
      `,

      // ============================================================
      // RETURNS SUMMARY
      //
      // Returns are reported separately and never deducted from the
      // Sales by Item summary, category, product, supplier or trend data.
      // ============================================================
      prisma.$queryRaw`
        SELECT
          COALESCE(
            SUM(scri.qty),
            0
          )::int AS returned_units,

          COALESCE(
            SUM(scri.amount),
            0
          )::numeric AS refund_amount,

          COALESCE(
            SUM(COALESCE(ssi.cp, 0) * scri.qty),
            0
          )::numeric AS returned_cogs

        FROM store_customer_return_items scri

        JOIN store_customer_returns scr
          ON scr.return_id = scri.return_id

        JOIN store_sales_items ssi
          ON ssi.sales_item_id = scri.sales_item_id

        JOIN store_products p
          ON p.product_id = ssi.product_id

        WHERE scr.owner_id = ${owner_id}
          AND p.owner_id = ${owner_id}
          AND p.type = 'item'
          AND scr.created_at >= ${startDate}
          AND scr.created_at < ${endDate}
      `,

      // ============================================================
      // LOW-STOCK ITEMS
      //
      // Current stock is intentionally not date-filtered.
      // ============================================================
      prisma.$queryRaw`
        SELECT
          p.product_id,
          p.product_name,

          COALESCE(
            c.category_name,
            'Uncategorized'
          ) AS category_name,

          COALESCE(
            SUM(sl.qty_remaining),
            0
          )::int AS qty_remaining,

          COALESCE(
            SUM(sl.qty_in),
            0
          )::int AS qty_in

        FROM store_products p

        LEFT JOIN store_stock_lots sl
          ON sl.product_id = p.product_id
          AND sl.owner_id = ${owner_id}

        LEFT JOIN store_categories c
          ON c.category_id = p.category_id

        WHERE p.owner_id = ${owner_id}
          AND p.type = 'item'

        GROUP BY
          p.product_id,
          p.product_name,
          c.category_name

        HAVING COALESCE(SUM(sl.qty_remaining), 0) <= 10

        ORDER BY qty_remaining ASC
      `,
    ]);

    // ============================================================
    // SHAPE RESPONSE
    // ============================================================

    const summaryRow = summaryRows[0] || {};
    const returnRow = returnRows[0] || {};

    const totalItemSales = Number(summaryRow.total_sales || 0);
    const totalItemCogs = Number(summaryRow.total_cogs || 0);
    const totalItemUnits = Number(summaryRow.total_units || 0);

    const returnedUnits = Number(returnRow.returned_units || 0);
    const refundAmount = Number(returnRow.refund_amount || 0);
    const returnedCogs = Number(returnRow.returned_cogs || 0);

    // Gross item profit only. Expenses and returns are not deducted.
    const grossItemProfit = totalItemSales - totalItemCogs;

    const marginPercent =
      totalItemSales > 0
        ? Number(((grossItemProfit / totalItemSales) * 100).toFixed(1))
        : 0;

    const categories = categoryRows.map((category) => {
      const categorySales = Number(category.total_sales || 0);
      const categoryUnits = Number(category.total_units || 0);

      return {
        category_id: category.category_id,
        category_name: category.category_name,
        total_sales: Number(categorySales.toFixed(2)),
        total_units: categoryUnits,
        share_percent:
          totalItemSales > 0
            ? Number(((categorySales / totalItemSales) * 100).toFixed(1))
            : 0,
      };
    });

    const topProducts = productRows.map((product) => {
      const productSales = Number(product.total_sales || 0);
      const productCogs = Number(product.total_cogs || 0);
      const productUnits = Number(product.total_units || 0);

      const productProfit = productSales - productCogs;

      const productMargin =
        productSales > 0
          ? Number(((productProfit / productSales) * 100).toFixed(1))
          : 0;

      return {
        product_id: product.product_id,
        product_name: product.product_name,
        category_name: product.category_name,
        total_units: productUnits,
        total_sales: Number(productSales.toFixed(2)),
        total_cogs: Number(productCogs.toFixed(2)),
        profit: Number(productProfit.toFixed(2)),
        margin_percent: productMargin,
      };
    });

    const suppliers = supplierRows.map((supplier) => ({
      supplier_id: supplier.supplier_id,
      supplier_name: supplier.supplier_name,
      total_sales: Number(Number(supplier.total_sales || 0).toFixed(2)),
      total_units: Number(supplier.total_units || 0),
    }));

    const trend = trendRows.map((entry) => ({
      date: entry.date,
      total: Number(Number(entry.total || 0).toFixed(2)),
    }));

    const lowStock = lowStockRows.map((item) => {
      const quantityRemaining = Number(item.qty_remaining || 0);

      return {
        product_id: item.product_id,
        product_name: item.product_name,
        category_name: item.category_name,
        qty_remaining: quantityRemaining,
        qty_in: Number(item.qty_in || 0),
        level: quantityRemaining <= 5 ? "critical" : "low",
      };
    });

    return {
      period: {
        from: startDate.toISOString(),
        to_exclusive: endDate.toISOString(),
      },

      summary: {
        total_item_sales: Number(totalItemSales.toFixed(2)),
        total_units_sold: totalItemUnits,
        total_cogs: Number(totalItemCogs.toFixed(2)),
        profit: Number(grossItemProfit.toFixed(2)),
        margin_percent: marginPercent,
      },

      returns: {
        returned_units: returnedUnits,
        refund_amount: Number(refundAmount.toFixed(2)),
        returned_cogs: Number(returnedCogs.toFixed(2)),
      },

      categories,
      top_products: topProducts,
      suppliers,
      trend,
      low_stock: lowStock,
    };
  }
}

export default new StoreSalesItemReportService();