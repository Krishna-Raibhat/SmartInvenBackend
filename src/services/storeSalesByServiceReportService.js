// src/services/storeSalesByServiceReportService.js
import { prisma } from "../prisma/client.js";

class StoreSalesByServiceReportService {
  async salesByService(owner_id, { from, to } = {}) {
    const startDate = from ? new Date(from) : null;
    const endDate   = to   ? (() => { const d = new Date(to); d.setHours(23,59,59,999); return d; })() : null;

    const [summaryRows, categoryRows, serviceRows, trendRows] = await Promise.all([

      // ── Summary totals ──────────────────────────────────────────────────
      startDate && endDate
        ? prisma.$queryRaw`
            SELECT
              COALESCE(SUM(ssi.line_total), 0)::numeric  AS total_revenue,
              COALESCE(SUM(ssi.qty), 0)::int             AS total_units,
              COUNT(DISTINCT ssi.product_id)::int        AS total_services
            FROM store_sales_items ssi
            JOIN store_sales ss ON ss.sales_id = ssi.sales_id
            JOIN store_products p ON p.product_id = ssi.product_id
            WHERE ss.owner_id = ${owner_id}
              AND p.type = 'service'
              AND ss.created_at >= ${startDate}
              AND ss.created_at <= ${endDate}
          `
        : prisma.$queryRaw`
            SELECT
              COALESCE(SUM(ssi.line_total), 0)::numeric  AS total_revenue,
              COALESCE(SUM(ssi.qty), 0)::int             AS total_units,
              COUNT(DISTINCT ssi.product_id)::int        AS total_services
            FROM store_sales_items ssi
            JOIN store_sales ss ON ss.sales_id = ssi.sales_id
            JOIN store_products p ON p.product_id = ssi.product_id
            WHERE ss.owner_id = ${owner_id}
              AND p.type = 'service'
          `,

      // ── By category ────────────────────────────────────────────────────
      startDate && endDate
        ? prisma.$queryRaw`
            SELECT
              COALESCE(c.category_id::text, '__uncat__')  AS category_id,
              COALESCE(c.category_name, 'Uncategorized')  AS category_name,
              SUM(ssi.line_total)::numeric                AS total_revenue,
              SUM(ssi.qty)::int                           AS total_units
            FROM store_sales_items ssi
            JOIN store_sales ss ON ss.sales_id = ssi.sales_id
            JOIN store_products p ON p.product_id = ssi.product_id
            LEFT JOIN store_categories c ON c.category_id = p.category_id
            WHERE ss.owner_id = ${owner_id}
              AND p.type = 'service'
              AND ss.created_at >= ${startDate}
              AND ss.created_at <= ${endDate}
            GROUP BY c.category_id, c.category_name
            ORDER BY total_revenue DESC
          `
        : prisma.$queryRaw`
            SELECT
              COALESCE(c.category_id::text, '__uncat__')  AS category_id,
              COALESCE(c.category_name, 'Uncategorized')  AS category_name,
              SUM(ssi.line_total)::numeric                AS total_revenue,
              SUM(ssi.qty)::int                           AS total_units
            FROM store_sales_items ssi
            JOIN store_sales ss ON ss.sales_id = ssi.sales_id
            JOIN store_products p ON p.product_id = ssi.product_id
            LEFT JOIN store_categories c ON c.category_id = p.category_id
            WHERE ss.owner_id = ${owner_id}
              AND p.type = 'service'
            GROUP BY c.category_id, c.category_name
            ORDER BY total_revenue DESC
          `,

      // ── By service product (top 10) ─────────────────────────────────────
      startDate && endDate
        ? prisma.$queryRaw`
            SELECT
              p.product_id,
              p.product_name,
              COALESCE(c.category_name, 'Uncategorized') AS category_name,
              COALESCE(p.cp, 0)::numeric                 AS cp,
              COALESCE(p.sp, 0)::numeric                 AS sp,
              SUM(ssi.line_total)::numeric                AS total_revenue,
              SUM(ssi.qty)::int                           AS total_units
            FROM store_sales_items ssi
            JOIN store_sales ss ON ss.sales_id = ssi.sales_id
            JOIN store_products p ON p.product_id = ssi.product_id
            LEFT JOIN store_categories c ON c.category_id = p.category_id
            WHERE ss.owner_id = ${owner_id}
              AND p.type = 'service'
              AND ss.created_at >= ${startDate}
              AND ss.created_at <= ${endDate}
            GROUP BY p.product_id, p.product_name, c.category_name, p.cp, p.sp
            ORDER BY total_revenue DESC
            LIMIT 10
          `
        : prisma.$queryRaw`
            SELECT
              p.product_id,
              p.product_name,
              COALESCE(c.category_name, 'Uncategorized') AS category_name,
              COALESCE(p.cp, 0)::numeric                 AS cp,
              COALESCE(p.sp, 0)::numeric                 AS sp,
              SUM(ssi.line_total)::numeric                AS total_revenue,
              SUM(ssi.qty)::int                           AS total_units
            FROM store_sales_items ssi
            JOIN store_sales ss ON ss.sales_id = ssi.sales_id
            JOIN store_products p ON p.product_id = ssi.product_id
            LEFT JOIN store_categories c ON c.category_id = p.category_id
            WHERE ss.owner_id = ${owner_id}
              AND p.type = 'service'
            GROUP BY p.product_id, p.product_name, c.category_name, p.cp, p.sp
            ORDER BY total_revenue DESC
            LIMIT 10
          `,

      // ── Daily trend ────────────────────────────────────────────────────
      startDate && endDate
        ? prisma.$queryRaw`
            SELECT
              DATE(ss.created_at)::text    AS date,
              SUM(ssi.line_total)::numeric  AS total
            FROM store_sales_items ssi
            JOIN store_sales ss ON ss.sales_id = ssi.sales_id
            JOIN store_products p ON p.product_id = ssi.product_id
            WHERE ss.owner_id = ${owner_id}
              AND p.type = 'service'
              AND ss.created_at >= ${startDate}
              AND ss.created_at <= ${endDate}
            GROUP BY DATE(ss.created_at)
            ORDER BY date ASC
          `
        : prisma.$queryRaw`
            SELECT
              DATE(ss.created_at)::text    AS date,
              SUM(ssi.line_total)::numeric  AS total
            FROM store_sales_items ssi
            JOIN store_sales ss ON ss.sales_id = ssi.sales_id
            JOIN store_products p ON p.product_id = ssi.product_id
            WHERE ss.owner_id = ${owner_id}
              AND p.type = 'service'
            GROUP BY DATE(ss.created_at)
            ORDER BY date ASC
          `,
    ]);

    const sr = summaryRows[0] || {};
    const totalRevenue = Number(sr.total_revenue || 0);

    const categories = categoryRows.map((c) => ({
      category_id:    c.category_id,
      category_name:  c.category_name,
      total_revenue:  Number(c.total_revenue),
      total_units:    Number(c.total_units),
      share_percent:  totalRevenue > 0
        ? Number(((Number(c.total_revenue) / totalRevenue) * 100).toFixed(1))
        : 0,
    }));

    const top_services = serviceRows.map((s) => {
      const rev    = Number(s.total_revenue);
      const cp     = Number(s.cp);
      const sp     = Number(s.sp);
      const profit = cp > 0 ? rev - cp * Number(s.total_units) : rev; // pure revenue if no cp
      const margin = sp > 0 ? ((sp - cp) / sp) * 100 : 100;
      return {
        product_id:    s.product_id,
        product_name:  s.product_name,
        category_name: s.category_name,
        cp,
        sp,
        total_units:   Number(s.total_units),
        total_revenue: Number(rev.toFixed(2)),
        profit:        Number(profit.toFixed(2)),
        margin_percent: Number(margin.toFixed(1)),
      };
    });

    const trend = trendRows.map((t) => ({
      date:  t.date,
      total: Number(Number(t.total).toFixed(2)),
    }));

    return {
      summary: {
        total_revenue:   Number(totalRevenue.toFixed(2)),
        total_units:     Number(sr.total_units || 0),
        total_services:  Number(sr.total_services || 0),
      },
      categories,
      top_services,
      trend,
    };
  }
}

export default new StoreSalesByServiceReportService();
