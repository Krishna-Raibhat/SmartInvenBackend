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
        // Uses same calculation as dashboard for consistency
        startDate && endDate
          ? prisma.$queryRaw`
              WITH sold AS (
                SELECT
                  ss.sales_id,
                  GREATEST(ss.total_amount - COALESCE(ss.discount, 0), 0) AS effective_total,
                  COALESCE(SUM(COALESCE(ssi.cp, 0) * ssi.qty), 0)         AS sold_cost,
                  COALESCE(SUM(ssi.qty), 0)                                AS sold_qty
                FROM store_sales_items ssi
                JOIN store_sales ss ON ss.sales_id = ssi.sales_id
                JOIN store_products p ON p.product_id = ssi.product_id
                WHERE ss.owner_id = ${owner_id}
                  AND p.type = 'item'
                  AND ss.created_at >= ${startDate}
                  AND ss.created_at <= ${endDate}
                GROUP BY ss.sales_id, ss.total_amount, ss.discount
              ),
              returns AS (
                SELECT
                  r_refund.sales_id,
                  COALESCE(r_refund.total_refund, 0) AS total_refund,
                  COALESCE(r_cost.returned_cost, 0) AS returned_cost,
                  COALESCE(r_cost.returned_qty, 0) AS returned_qty
                FROM (
                  SELECT sales_id, SUM(refund_amount) AS total_refund
                  FROM store_customer_returns
                  WHERE owner_id = ${owner_id}
                    AND created_at >= ${startDate}
                    AND created_at <= ${endDate}
                  GROUP BY sales_id
                ) r_refund
                LEFT JOIN (
                  SELECT scr.sales_id, 
                    SUM(COALESCE(ssi.cp, 0) * scri.qty) AS returned_cost,
                    SUM(scri.qty) AS returned_qty
                  FROM store_customer_returns scr
                  JOIN store_customer_return_items scri ON scri.return_id = scr.return_id
                  JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
                  JOIN store_products p ON p.product_id = ssi.product_id
                  WHERE scr.owner_id = ${owner_id}
                    AND p.type = 'item'
                    AND scr.created_at >= ${startDate}
                    AND scr.created_at <= ${endDate}
                  GROUP BY scr.sales_id
                ) r_cost ON r_cost.sales_id = r_refund.sales_id
              )
              SELECT
                COALESCE(SUM(s.effective_total), 0) - COALESCE(SUM(r.total_refund), 0)  AS total_sales,
                COALESCE(SUM(s.sold_cost), 0)       - COALESCE(SUM(r.returned_cost), 0) AS total_cogs,
                COALESCE(SUM(s.sold_qty), 0)        - COALESCE(SUM(r.returned_qty), 0)  AS total_units
              FROM sold s
              LEFT JOIN returns r ON r.sales_id = s.sales_id
            `
          : prisma.$queryRaw`
              WITH sold AS (
                SELECT
                  ss.sales_id,
                  GREATEST(ss.total_amount - COALESCE(ss.discount, 0), 0) AS effective_total,
                  COALESCE(SUM(COALESCE(ssi.cp, 0) * ssi.qty), 0)         AS sold_cost,
                  COALESCE(SUM(ssi.qty), 0)                                AS sold_qty
                FROM store_sales_items ssi
                JOIN store_sales ss ON ss.sales_id = ssi.sales_id
                JOIN store_products p ON p.product_id = ssi.product_id
                WHERE ss.owner_id = ${owner_id}
                  AND p.type = 'item'
                GROUP BY ss.sales_id, ss.total_amount, ss.discount
              ),
              returns AS (
                SELECT
                  r_refund.sales_id,
                  COALESCE(r_refund.total_refund, 0) AS total_refund,
                  COALESCE(r_cost.returned_cost, 0) AS returned_cost,
                  COALESCE(r_cost.returned_qty, 0) AS returned_qty
                FROM (
                  SELECT sales_id, SUM(refund_amount) AS total_refund
                  FROM store_customer_returns
                  WHERE owner_id = ${owner_id}
                  GROUP BY sales_id
                ) r_refund
                LEFT JOIN (
                  SELECT scr.sales_id, 
                    SUM(COALESCE(ssi.cp, 0) * scri.qty) AS returned_cost,
                    SUM(scri.qty) AS returned_qty
                  FROM store_customer_returns scr
                  JOIN store_customer_return_items scri ON scri.return_id = scr.return_id
                  JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
                  JOIN store_products p ON p.product_id = ssi.product_id
                  WHERE scr.owner_id = ${owner_id}
                    AND p.type = 'item'
                  GROUP BY scr.sales_id
                ) r_cost ON r_cost.sales_id = r_refund.sales_id
              )
              SELECT
                COALESCE(SUM(s.effective_total), 0) - COALESCE(SUM(r.total_refund), 0)  AS total_sales,
                COALESCE(SUM(s.sold_cost), 0)       - COALESCE(SUM(r.returned_cost), 0) AS total_cogs,
                COALESCE(SUM(s.sold_qty), 0)        - COALESCE(SUM(r.returned_qty), 0)  AS total_units
              FROM sold s
              LEFT JOIN returns r ON r.sales_id = s.sales_id
            `,

        // ── By category ────────────────────────────────────────────────────
        // Uses original SP * qty (no proportional discount applied here)
        startDate && endDate
          ? prisma.$queryRaw`
              WITH item_sales AS (
                SELECT
                  COALESCE(c.category_id::text, '__uncat__') AS category_id,
                  COALESCE(c.category_name, 'Uncategorized') AS category_name,
                  ssi.sp * ssi.qty AS item_sales,
                  ssi.qty
                FROM store_sales_items ssi
                JOIN store_sales ss ON ss.sales_id = ssi.sales_id
                JOIN store_products p ON p.product_id = ssi.product_id
                LEFT JOIN store_categories c ON c.category_id = p.category_id
                WHERE ss.owner_id = ${owner_id}
                  AND p.type = 'item'
                  AND ss.created_at >= ${startDate}
                  AND ss.created_at <= ${endDate}
              ),
              returns_by_category AS (
                SELECT
                  COALESCE(c.category_id::text, '__uncat__') AS category_id,
                  COALESCE(SUM(ssi.sp * scri.qty), 0) AS returned_sales,
                  COALESCE(SUM(scri.qty), 0) AS returned_units
                FROM store_customer_return_items scri
                JOIN store_customer_returns scr ON scr.return_id = scri.return_id
                JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
                JOIN store_products p ON p.product_id = ssi.product_id
                LEFT JOIN store_categories c ON c.category_id = p.category_id
                WHERE scr.owner_id = ${owner_id}
                  AND p.type = 'item'
                  AND scr.created_at >= ${startDate}
                  AND scr.created_at <= ${endDate}
                GROUP BY c.category_id
              )
              SELECT
                s.category_id,
                MAX(s.category_name) AS category_name,
                SUM(s.item_sales) - COALESCE(MAX(r.returned_sales), 0) AS total_sales,
                SUM(s.qty) - COALESCE(MAX(r.returned_units), 0) AS total_units
              FROM item_sales s
              LEFT JOIN returns_by_category r ON r.category_id = s.category_id
              GROUP BY s.category_id
              HAVING (SUM(s.item_sales) - COALESCE(MAX(r.returned_sales), 0)) > 0
              ORDER BY total_sales DESC
            `
          : prisma.$queryRaw`
              WITH item_sales AS (
                SELECT
                  COALESCE(c.category_id::text, '__uncat__') AS category_id,
                  COALESCE(c.category_name, 'Uncategorized') AS category_name,
                  ssi.sp * ssi.qty AS item_sales,
                  ssi.qty
                FROM store_sales_items ssi
                JOIN store_sales ss ON ss.sales_id = ssi.sales_id
                JOIN store_products p ON p.product_id = ssi.product_id
                LEFT JOIN store_categories c ON c.category_id = p.category_id
                WHERE ss.owner_id = ${owner_id}
                  AND p.type = 'item'
              ),
              returns_by_category AS (
                SELECT
                  COALESCE(c.category_id::text, '__uncat__') AS category_id,
                  COALESCE(SUM(ssi.sp * scri.qty), 0) AS returned_sales,
                  COALESCE(SUM(scri.qty), 0) AS returned_units
                FROM store_customer_return_items scri
                JOIN store_customer_returns scr ON scr.return_id = scri.return_id
                JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
                JOIN store_products p ON p.product_id = ssi.product_id
                LEFT JOIN store_categories c ON c.category_id = p.category_id
                WHERE scr.owner_id = ${owner_id}
                  AND p.type = 'item'
                GROUP BY c.category_id
              )
              SELECT
                s.category_id,
                MAX(s.category_name) AS category_name,
                SUM(s.item_sales) - COALESCE(MAX(r.returned_sales), 0) AS total_sales,
                SUM(s.qty) - COALESCE(MAX(r.returned_units), 0) AS total_units
              FROM item_sales s
              LEFT JOIN returns_by_category r ON r.category_id = s.category_id
              GROUP BY s.category_id
              HAVING (SUM(s.item_sales) - COALESCE(MAX(r.returned_sales), 0)) > 0
              ORDER BY total_sales DESC
            `,

        // ── By product (top 10) ─────────────────────────────────────────────
        // Uses original SP * qty (no proportional discount applied here)
        startDate && endDate
          ? prisma.$queryRaw`
              WITH item_sales AS (
                SELECT
                  p.product_id,
                  p.product_name,
                  COALESCE(c.category_name, 'Uncategorized') AS category_name,
                  ssi.sp * ssi.qty AS item_sales,
                  ssi.qty,
                  COALESCE(ssi.cp, 0) * ssi.qty AS item_cost
                FROM store_sales_items ssi
                JOIN store_sales ss ON ss.sales_id = ssi.sales_id
                JOIN store_products p ON p.product_id = ssi.product_id
                LEFT JOIN store_categories c ON c.category_id = p.category_id
                WHERE ss.owner_id = ${owner_id}
                  AND p.type = 'item'
                  AND ss.created_at >= ${startDate}
                  AND ss.created_at <= ${endDate}
              ),
              returns_by_product AS (
                SELECT
                  p.product_id,
                  COALESCE(SUM(ssi.sp * scri.qty), 0) AS returned_sales,
                  COALESCE(SUM(scri.qty), 0) AS returned_units,
                  COALESCE(SUM(COALESCE(ssi.cp, 0) * scri.qty), 0) AS returned_cogs
                FROM store_customer_return_items scri
                JOIN store_customer_returns scr ON scr.return_id = scri.return_id
                JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
                JOIN store_products p ON p.product_id = ssi.product_id
                WHERE scr.owner_id = ${owner_id}
                  AND p.type = 'item'
                  AND scr.created_at >= ${startDate}
                  AND scr.created_at <= ${endDate}
                GROUP BY p.product_id
              )
              SELECT
                s.product_id,
                MAX(s.product_name) AS product_name,
                MAX(s.category_name) AS category_name,
                SUM(s.item_sales) - COALESCE(MAX(r.returned_sales), 0) AS total_sales,
                SUM(s.qty) - COALESCE(MAX(r.returned_units), 0) AS total_units,
                SUM(s.item_cost) - COALESCE(MAX(r.returned_cogs), 0) AS total_cogs
              FROM item_sales s
              LEFT JOIN returns_by_product r ON r.product_id = s.product_id
              GROUP BY s.product_id
              HAVING (SUM(s.item_sales) - COALESCE(MAX(r.returned_sales), 0)) > 0
              ORDER BY total_sales DESC
              LIMIT 10
            `
          : prisma.$queryRaw`
              WITH item_sales AS (
                SELECT
                  p.product_id,
                  p.product_name,
                  COALESCE(c.category_name, 'Uncategorized') AS category_name,
                  ssi.sp * ssi.qty AS item_sales,
                  ssi.qty,
                  COALESCE(ssi.cp, 0) * ssi.qty AS item_cost
                FROM store_sales_items ssi
                JOIN store_sales ss ON ss.sales_id = ssi.sales_id
                JOIN store_products p ON p.product_id = ssi.product_id
                LEFT JOIN store_categories c ON c.category_id = p.category_id
                WHERE ss.owner_id = ${owner_id}
                  AND p.type = 'item'
              ),
              returns_by_product AS (
                SELECT
                  p.product_id,
                  COALESCE(SUM(ssi.sp * scri.qty), 0) AS returned_sales,
                  COALESCE(SUM(scri.qty), 0) AS returned_units,
                  COALESCE(SUM(COALESCE(ssi.cp, 0) * scri.qty), 0) AS returned_cogs
                FROM store_customer_return_items scri
                JOIN store_customer_returns scr ON scr.return_id = scri.return_id
                JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
                JOIN store_products p ON p.product_id = ssi.product_id
                WHERE scr.owner_id = ${owner_id}
                  AND p.type = 'item'
                GROUP BY p.product_id
              )
              SELECT
                s.product_id,
                MAX(s.product_name) AS product_name,
                MAX(s.category_name) AS category_name,
                SUM(s.item_sales) - COALESCE(MAX(r.returned_sales), 0) AS total_sales,
                SUM(s.qty) - COALESCE(MAX(r.returned_units), 0) AS total_units,
                SUM(s.item_cost) - COALESCE(MAX(r.returned_cogs), 0) AS total_cogs
              FROM item_sales s
              LEFT JOIN returns_by_product r ON r.product_id = s.product_id
              GROUP BY s.product_id
              HAVING (SUM(s.item_sales) - COALESCE(MAX(r.returned_sales), 0)) > 0
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
              WITH daily_sales AS (
                SELECT
                  DATE(ss.created_at)::text    AS date,
                  SUM(ssi.line_total)::numeric AS total_sales
                FROM store_sales_items ssi
                JOIN store_sales ss ON ss.sales_id = ssi.sales_id
                JOIN store_products p ON p.product_id = ssi.product_id
                WHERE ss.owner_id = ${owner_id}
                  AND p.type = 'item'
                  AND ss.created_at >= ${startDate}
                  AND ss.created_at <= ${endDate}
                GROUP BY DATE(ss.created_at)
              ),
              daily_returns AS (
                SELECT
                  DATE(scr.created_at)::text   AS date,
                  SUM(scri.amount)::numeric    AS returned_sales
                FROM store_customer_return_items scri
                JOIN store_customer_returns scr ON scr.return_id = scri.return_id
                JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
                JOIN store_products p ON p.product_id = ssi.product_id
                WHERE scr.owner_id = ${owner_id}
                  AND p.type = 'item'
                  AND scr.created_at >= ${startDate}
                  AND scr.created_at <= ${endDate}
                GROUP BY DATE(scr.created_at)
              )
              SELECT
                s.date,
                s.total_sales - COALESCE(r.returned_sales, 0) AS total
              FROM daily_sales s
              LEFT JOIN daily_returns r ON r.date = s.date
              ORDER BY s.date ASC
            `
          : prisma.$queryRaw`
              WITH daily_sales AS (
                SELECT
                  DATE(ss.created_at)::text    AS date,
                  SUM(ssi.line_total)::numeric AS total_sales
                FROM store_sales_items ssi
                JOIN store_sales ss ON ss.sales_id = ssi.sales_id
                JOIN store_products p ON p.product_id = ssi.product_id
                WHERE ss.owner_id = ${owner_id}
                  AND p.type = 'item'
                GROUP BY DATE(ss.created_at)
              ),
              daily_returns AS (
                SELECT
                  DATE(scr.created_at)::text   AS date,
                  SUM(scri.amount)::numeric    AS returned_sales
                FROM store_customer_return_items scri
                JOIN store_customer_returns scr ON scr.return_id = scri.return_id
                JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
                JOIN store_products p ON p.product_id = ssi.product_id
                WHERE scr.owner_id = ${owner_id}
                  AND p.type = 'item'
                GROUP BY DATE(scr.created_at)
              )
              SELECT
                s.date,
                s.total_sales - COALESCE(r.returned_sales, 0) AS total
              FROM daily_sales s
              LEFT JOIN daily_returns r ON r.date = s.date
              ORDER BY s.date ASC
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

    const netSales          = Number(sr.total_sales   || 0);  // Already net (gross - returns)
    const netCogs           = Number(sr.total_cogs    || 0);  // Already net (cost - returned cost)
    const netUnits          = Number(sr.total_units   || 0);  // Already net (sold - returned)
    const returnedUnits     = Number(rr.returned_units|| 0);
    const refundAmount      = Number(rr.refund_amount || 0);
    const returnedCogs      = Number(rr.returned_cogs || 0);

    const netGrossProfit    = netSales - netCogs;

    const categories = categoryRows.map((c) => ({
      category_id:   c.category_id,
      category_name: c.category_name,
      total_sales:   Number(c.total_sales),
      total_units:   Number(c.total_units),
      share_percent: netSales > 0
        ? Number(((Number(c.total_sales) / netSales) * 100).toFixed(1))
        : 0,
    }));

    const top_products = productRows.map((p) => {
      const ps = Number(p.total_sales);
      const pc = Number(p.total_cogs);
      const profit = ps - pc;
      return {
        product_id:    p.product_id,
        product_name:  p.product_name,
        category_name: p.category_name,
        total_units:   Number(p.total_units),
        total_sales:   Number(ps.toFixed(2)),
        total_cogs:    Number(pc.toFixed(2)),
        profit:        Number(profit.toFixed(2)),
        margin_percent: ps > 0 ? Number(((profit / ps) * 100).toFixed(1)) : 0,
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
        total_units_sold: netUnits,
        total_cogs:       Number(netCogs.toFixed(2)),
        profit:           Number(netGrossProfit.toFixed(2)),
        margin_percent:   netSales > 0
          ? Number(((netGrossProfit / netSales) * 100).toFixed(1))
          : 0,
      },
      returns: {
        returned_units:   returnedUnits,
        refund_amount:    Number(refundAmount.toFixed(2)),
        net_sales:        Number(netSales.toFixed(2)),
        profit:           Number(netGrossProfit.toFixed(2)),
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
