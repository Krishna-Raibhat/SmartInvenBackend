// src/services/storeSalesItemReportService.js
import { prisma } from "../prisma/client.js";

class StoreSalesItemReportService {
  async salesByItem(owner_id, { from, to } = {}) {
    const startDate = from ? new Date(from) : null;
    const endDate   = to   ? (() => { const d = new Date(to); d.setHours(23,59,59,999); return d; })() : null;

    // All heavy aggregation done in the DB via raw SQL — no row-by-row JS looping
    const [summaryRows, categoryRows, productRows, supplierRows, trendRows, returnRows, lowStockRows] =
      await Promise.all([

        // ── Summary totals ──────────────────────────────────────────────────
        startDate && endDate
          ? prisma.$queryRaw`
              SELECT
                COALESCE(SUM(ssi.line_total), 0)::numeric                   AS total_sales,
                COALESCE(SUM(COALESCE(ssi.cp,0) * ssi.qty), 0)::numeric    AS total_cogs,
                COALESCE(SUM(ssi.qty), 0)::int                              AS total_units
              FROM store_sales_items ssi
              JOIN store_sales ss ON ss.sales_id = ssi.sales_id
              JOIN store_products p ON p.product_id = ssi.product_id
              WHERE ss.owner_id = ${owner_id}
                AND p.type = 'item'
                AND ss.created_at >= ${startDate}
                AND ss.created_at <= ${endDate}
            `
          : prisma.$queryRaw`
              SELECT
                COALESCE(SUM(ssi.line_total), 0)::numeric                   AS total_sales,
                COALESCE(SUM(COALESCE(ssi.cp,0) * ssi.qty), 0)::numeric    AS total_cogs,
                COALESCE(SUM(ssi.qty), 0)::int                              AS total_units
              FROM store_sales_items ssi
              JOIN store_sales ss ON ss.sales_id = ssi.sales_id
              JOIN store_products p ON p.product_id = ssi.product_id
              WHERE ss.owner_id = ${owner_id}
                AND p.type = 'item'
            `,

        // ── By category ────────────────────────────────────────────────────
        startDate && endDate
          ? prisma.$queryRaw`
              SELECT
                COALESCE(c.category_id::text, '__uncat__')  AS category_id,
                COALESCE(c.category_name, 'Uncategorized')  AS category_name,
                SUM(ssi.line_total)::numeric                AS total_sales,
                SUM(ssi.qty)::int                           AS total_units
              FROM store_sales_items ssi
              JOIN store_sales ss ON ss.sales_id = ssi.sales_id
              JOIN store_products p ON p.product_id = ssi.product_id
              LEFT JOIN store_categories c ON c.category_id = p.category_id
              WHERE ss.owner_id = ${owner_id}
                AND p.type = 'item'
                AND ss.created_at >= ${startDate}
                AND ss.created_at <= ${endDate}
              GROUP BY c.category_id, c.category_name
              ORDER BY total_sales DESC
            `
          : prisma.$queryRaw`
              SELECT
                COALESCE(c.category_id::text, '__uncat__')  AS category_id,
                COALESCE(c.category_name, 'Uncategorized')  AS category_name,
                SUM(ssi.line_total)::numeric                AS total_sales,
                SUM(ssi.qty)::int                           AS total_units
              FROM store_sales_items ssi
              JOIN store_sales ss ON ss.sales_id = ssi.sales_id
              JOIN store_products p ON p.product_id = ssi.product_id
              LEFT JOIN store_categories c ON c.category_id = p.category_id
              WHERE ss.owner_id = ${owner_id}
                AND p.type = 'item'
              GROUP BY c.category_id, c.category_name
              ORDER BY total_sales DESC
            `,

        // ── By product (top 10) ─────────────────────────────────────────────
        startDate && endDate
          ? prisma.$queryRaw`
              SELECT
                p.product_id,
                p.product_name,
                COALESCE(c.category_name, 'Uncategorized') AS category_name,
                SUM(ssi.line_total)::numeric                AS total_sales,
                SUM(ssi.qty)::int                           AS total_units,
                SUM(COALESCE(ssi.cp,0) * ssi.qty)::numeric AS total_cogs
              FROM store_sales_items ssi
              JOIN store_sales ss ON ss.sales_id = ssi.sales_id
              JOIN store_products p ON p.product_id = ssi.product_id
              LEFT JOIN store_categories c ON c.category_id = p.category_id
              WHERE ss.owner_id = ${owner_id}
                AND p.type = 'item'
                AND ss.created_at >= ${startDate}
                AND ss.created_at <= ${endDate}
              GROUP BY p.product_id, p.product_name, c.category_name
              ORDER BY total_sales DESC
              LIMIT 10
            `
          : prisma.$queryRaw`
              SELECT
                p.product_id,
                p.product_name,
                COALESCE(c.category_name, 'Uncategorized') AS category_name,
                SUM(ssi.line_total)::numeric                AS total_sales,
                SUM(ssi.qty)::int                           AS total_units,
                SUM(COALESCE(ssi.cp,0) * ssi.qty)::numeric AS total_cogs
              FROM store_sales_items ssi
              JOIN store_sales ss ON ss.sales_id = ssi.sales_id
              JOIN store_products p ON p.product_id = ssi.product_id
              LEFT JOIN store_categories c ON c.category_id = p.category_id
              WHERE ss.owner_id = ${owner_id}
                AND p.type = 'item'
              GROUP BY p.product_id, p.product_name, c.category_name
              ORDER BY total_sales DESC
              LIMIT 10
            `,

        // ── By supplier ────────────────────────────────────────────────────
        startDate && endDate
          ? prisma.$queryRaw`
              SELECT
                sup.supplier_id,
                sup.supplier_name,
                SUM(ssi.line_total)::numeric AS total_sales,
                SUM(ssi.qty)::int            AS total_units
              FROM store_sales_items ssi
              JOIN store_sales ss ON ss.sales_id = ssi.sales_id
              JOIN store_products p ON p.product_id = ssi.product_id
              JOIN store_stock_lots sl ON sl.lot_id = ssi.lot_id
              JOIN store_suppliers sup ON sup.supplier_id = sl.supplier_id
              WHERE ss.owner_id = ${owner_id}
                AND p.type = 'item'
                AND ss.created_at >= ${startDate}
                AND ss.created_at <= ${endDate}
              GROUP BY sup.supplier_id, sup.supplier_name
              ORDER BY total_sales DESC
            `
          : prisma.$queryRaw`
              SELECT
                sup.supplier_id,
                sup.supplier_name,
                SUM(ssi.line_total)::numeric AS total_sales,
                SUM(ssi.qty)::int            AS total_units
              FROM store_sales_items ssi
              JOIN store_sales ss ON ss.sales_id = ssi.sales_id
              JOIN store_products p ON p.product_id = ssi.product_id
              JOIN store_stock_lots sl ON sl.lot_id = ssi.lot_id
              JOIN store_suppliers sup ON sup.supplier_id = sl.supplier_id
              WHERE ss.owner_id = ${owner_id}
                AND p.type = 'item'
              GROUP BY sup.supplier_id, sup.supplier_name
              ORDER BY total_sales DESC
            `,

        // ── Daily trend ────────────────────────────────────────────────────
        startDate && endDate
          ? prisma.$queryRaw`
              SELECT
                DATE(ss.created_at)::text   AS date,
                SUM(ssi.line_total)::numeric AS total
              FROM store_sales_items ssi
              JOIN store_sales ss ON ss.sales_id = ssi.sales_id
              JOIN store_products p ON p.product_id = ssi.product_id
              WHERE ss.owner_id = ${owner_id}
                AND p.type = 'item'
                AND ss.created_at >= ${startDate}
                AND ss.created_at <= ${endDate}
              GROUP BY DATE(ss.created_at)
              ORDER BY date ASC
            `
          : prisma.$queryRaw`
              SELECT
                DATE(ss.created_at)::text   AS date,
                SUM(ssi.line_total)::numeric AS total
              FROM store_sales_items ssi
              JOIN store_sales ss ON ss.sales_id = ssi.sales_id
              JOIN store_products p ON p.product_id = ssi.product_id
              WHERE ss.owner_id = ${owner_id}
                AND p.type = 'item'
              GROUP BY DATE(ss.created_at)
              ORDER BY date ASC
            `,

        // ── Returns aggregation ────────────────────────────────────────────
        startDate && endDate
          ? prisma.$queryRaw`
              SELECT
                COALESCE(SUM(scri.qty), 0)::int                           AS returned_units,
                COALESCE(SUM(scri.amount), 0)::numeric                    AS refund_amount,
                COALESCE(SUM(COALESCE(ssi.cp,0) * scri.qty), 0)::numeric AS returned_cogs,
                COALESCE(SUM(CASE WHEN ssi.product_id IS NOT NULL THEN scri.qty END), 0)::int AS ret_units_by_prod
              FROM store_customer_return_items scri
              JOIN store_customer_returns scr ON scr.return_id = scri.return_id
              JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
              JOIN store_products p ON p.product_id = ssi.product_id
              WHERE scr.owner_id = ${owner_id}
                AND p.type = 'item'
                AND scr.created_at >= ${startDate}
                AND scr.created_at <= ${endDate}
            `
          : prisma.$queryRaw`
              SELECT
                COALESCE(SUM(scri.qty), 0)::int                           AS returned_units,
                COALESCE(SUM(scri.amount), 0)::numeric                    AS refund_amount,
                COALESCE(SUM(COALESCE(ssi.cp,0) * scri.qty), 0)::numeric AS returned_cogs
              FROM store_customer_return_items scri
              JOIN store_customer_returns scr ON scr.return_id = scri.return_id
              JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
              JOIN store_products p ON p.product_id = ssi.product_id
              WHERE scr.owner_id = ${owner_id}
                AND p.type = 'item'
            `,

        // ── Low stock ──────────────────────────────────────────────────────
        prisma.$queryRaw`
          SELECT
            p.product_id,
            p.product_name,
            COALESCE(c.category_name, 'Uncategorized') AS category_name,
            COALESCE(SUM(sl.qty_remaining), 0)::int     AS qty_remaining,
            COALESCE(SUM(sl.qty_in), 0)::int            AS qty_in
          FROM store_products p
          LEFT JOIN store_stock_lots sl ON sl.product_id = p.product_id AND sl.owner_id = ${owner_id}
          LEFT JOIN store_categories c ON c.category_id = p.category_id
          WHERE p.owner_id = ${owner_id}
            AND p.type = 'item'
          GROUP BY p.product_id, p.product_name, c.category_name
          HAVING COALESCE(SUM(sl.qty_remaining), 0) <= 10
          ORDER BY qty_remaining ASC
        `,
      ]);

    // ── Shape results ────────────────────────────────────────────────────────
    const sr  = summaryRows[0]  || {};
    const rr  = returnRows[0]   || {};

    const totalSales        = Number(sr.total_sales   || 0);
    const totalCogs         = Number(sr.total_cogs    || 0);
    const totalUnits        = Number(sr.total_units   || 0);
    const returnedUnits     = Number(rr.returned_units|| 0);
    const refundAmount      = Number(rr.refund_amount || 0);
    const returnedCogs      = Number(rr.returned_cogs || 0);

    const netSales          = totalSales - refundAmount;
    const netCogs           = totalCogs  - returnedCogs;
    const netGrossProfit    = netSales   - netCogs;

    const categories = categoryRows.map((c) => ({
      category_id:   c.category_id,
      category_name: c.category_name,
      total_sales:   Number(c.total_sales),
      total_units:   Number(c.total_units),
      share_percent: totalSales > 0
        ? Number(((Number(c.total_sales) / totalSales) * 100).toFixed(1))
        : 0,
    }));

    const top_products = productRows.map((p) => {
      const ps = Number(p.total_sales);
      const pc = Number(p.total_cogs);
      const gp = ps - pc;
      return {
        product_id:    p.product_id,
        product_name:  p.product_name,
        category_name: p.category_name,
        total_units:   Number(p.total_units),
        total_sales:   Number(ps.toFixed(2)),
        total_cogs:    Number(pc.toFixed(2)),
        gross_profit:  Number(gp.toFixed(2)),
        margin_percent: ps > 0 ? Number(((gp / ps) * 100).toFixed(1)) : 0,
      };
    });

    const suppliers = supplierRows.map((s) => ({
      supplier_id:   s.supplier_id,
      supplier_name: s.supplier_name,
      total_sales:   Number(Number(s.total_sales).toFixed(2)),
      total_units:   Number(s.total_units),
    }));

    const trend = trendRows.map((t) => ({
      date:  t.date,
      total: Number(Number(t.total).toFixed(2)),
    }));

    const low_stock = lowStockRows.map((l) => ({
      product_id:    l.product_id,
      product_name:  l.product_name,
      category_name: l.category_name,
      qty_remaining: Number(l.qty_remaining),
      qty_in:        Number(l.qty_in),
      level:         Number(l.qty_remaining) <= 5 ? "critical" : "low",
    }));

    return {
      summary: {
        total_item_sales: Number(netSales.toFixed(2)),
        total_units_sold: totalUnits - returnedUnits,
        total_cogs:       Number(netCogs.toFixed(2)),
        gross_profit:     Number(netGrossProfit.toFixed(2)),
        margin_percent:   netSales > 0
          ? Number(((netGrossProfit / netSales) * 100).toFixed(1))
          : 0,
      },
      returns: {
        gross_sales:      Number(totalSales.toFixed(2)),
        returned_units:   returnedUnits,
        refund_amount:    Number(refundAmount.toFixed(2)),
        net_sales:        Number(netSales.toFixed(2)),
        net_gross_profit: Number(netGrossProfit.toFixed(2)),
      },
      categories,
      top_products,
      suppliers,
      trend,
      low_stock,
    };
  }
}

export default new StoreSalesItemReportService();
