// // src/services/storeSalesByServiceReportService.js
// src/services/storeSalesByServiceReportService.js

import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

class StoreSalesByServiceReportService {
  async salesByService(owner_id, { from, to } = {}) {
    const startDate = from ? new Date(from) : null;

    const endDate = to
      ? (() => {
          const date = new Date(to);
          date.setHours(23, 59, 59, 999);
          return date;
        })()
      : null;

    if (startDate && Number.isNaN(startDate.getTime())) {
      const error = new Error("Invalid from date");
      error.status = 400;
      error.code = "VALIDATION_FROM_DATE_INVALID";
      throw error;
    }

    if (endDate && Number.isNaN(endDate.getTime())) {
      const error = new Error("Invalid to date");
      error.status = 400;
      error.code = "VALIDATION_TO_DATE_INVALID";
      throw error;
    }

    if (startDate && endDate && startDate > endDate) {
      const error = new Error("From date cannot be after to date");
      error.status = 400;
      error.code = "VALIDATION_DATE_RANGE_INVALID";
      throw error;
    }

    const dateCondition =
      startDate && endDate
        ? Prisma.sql`
            AND ss.created_at >= ${startDate}
            AND ss.created_at <= ${endDate}
          `
        : startDate
          ? Prisma.sql`
              AND ss.created_at >= ${startDate}
            `
          : endDate
            ? Prisma.sql`
                AND ss.created_at <= ${endDate}
              `
            : Prisma.sql``;

    /*
     * Invoice discount is proportionally distributed to each sales line.
     *
     * Because every query filters:
     *
     * p.type = 'service'
     *
     * item sales, item quantities and item COGS are completely excluded.
     */

    const [summaryRows, categoryRows, serviceRows, trendRows] =
      await Promise.all([
        // ============================================================
        // SUMMARY
        // ============================================================

        prisma.$queryRaw`
          SELECT
            COALESCE(
              SUM(
                ssi.line_total *
                CASE
                  WHEN ss.total_amount > 0 THEN
                    GREATEST(
                      ss.total_amount - COALESCE(ss.discount, 0),
                      0
                    ) / ss.total_amount
                  ELSE 1
                END
              ),
              0
            )::numeric AS total_revenue,

            COALESCE(
              SUM(COALESCE(ssi.cp, 0) * ssi.qty),
              0
            )::numeric AS total_cogs,

            COALESCE(
              SUM(ssi.qty),
              0
            )::int AS total_units,

            COUNT(
              DISTINCT ssi.product_id
            )::int AS total_services

          FROM store_sales_items ssi

          JOIN store_sales ss
            ON ss.sales_id = ssi.sales_id

          JOIN store_products p
            ON p.product_id = ssi.product_id

          WHERE ss.owner_id = ${owner_id}
            AND ssi.owner_id = ${owner_id}
            AND p.owner_id = ${owner_id}
            AND p.type = 'service'

            ${dateCondition}
        `,

        // ============================================================
        // SALES BY SERVICE CATEGORY
        // ============================================================

        prisma.$queryRaw`
          SELECT
            COALESCE(
              c.category_id::text,
              '__uncat__'
            ) AS category_id,

            COALESCE(
              c.category_name,
              'Uncategorized'
            ) AS category_name,

            COALESCE(
              SUM(
                ssi.line_total *
                CASE
                  WHEN ss.total_amount > 0 THEN
                    GREATEST(
                      ss.total_amount - COALESCE(ss.discount, 0),
                      0
                    ) / ss.total_amount
                  ELSE 1
                END
              ),
              0
            )::numeric AS total_revenue,

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
            AND ssi.owner_id = ${owner_id}
            AND p.owner_id = ${owner_id}
            AND p.type = 'service'

            ${dateCondition}

          GROUP BY
            c.category_id,
            c.category_name

          ORDER BY total_revenue DESC
        `,

        // ============================================================
        // TOP SERVICE PRODUCTS
        //
        // Uses historical ssi.cp from the sale.
        // It does not use the current product CP.
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
              SUM(
                ssi.line_total *
                CASE
                  WHEN ss.total_amount > 0 THEN
                    GREATEST(
                      ss.total_amount - COALESCE(ss.discount, 0),
                      0
                    ) / ss.total_amount
                  ELSE 1
                END
              ),
              0
            )::numeric AS total_revenue,

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

          LEFT JOIN store_categories c
            ON c.category_id = p.category_id

          WHERE ss.owner_id = ${owner_id}
            AND ssi.owner_id = ${owner_id}
            AND p.owner_id = ${owner_id}
            AND p.type = 'service'

            ${dateCondition}

          GROUP BY
            p.product_id,
            p.product_name,
            c.category_name

          ORDER BY total_revenue DESC

          LIMIT 10
        `,

        // ============================================================
        // DAILY SERVICE SALES TREND
        // ============================================================

        prisma.$queryRaw`
          SELECT
            DATE(ss.created_at)::text AS date,

            COALESCE(
              SUM(
                ssi.line_total *
                CASE
                  WHEN ss.total_amount > 0 THEN
                    GREATEST(
                      ss.total_amount - COALESCE(ss.discount, 0),
                      0
                    ) / ss.total_amount
                  ELSE 1
                END
              ),
              0
            )::numeric AS total

          FROM store_sales_items ssi

          JOIN store_sales ss
            ON ss.sales_id = ssi.sales_id

          JOIN store_products p
            ON p.product_id = ssi.product_id

          WHERE ss.owner_id = ${owner_id}
            AND ssi.owner_id = ${owner_id}
            AND p.owner_id = ${owner_id}
            AND p.type = 'service'

            ${dateCondition}

          GROUP BY DATE(ss.created_at)

          ORDER BY date ASC
        `,
      ]);

    // ============================================================
    // SHAPE SUMMARY
    // ============================================================

    const summaryRow = summaryRows[0] || {};

    const totalRevenue = Number(summaryRow.total_revenue || 0);
    const totalCogs = Number(summaryRow.total_cogs || 0);
    const totalUnits = Number(summaryRow.total_units || 0);
    const totalServices = Number(summaryRow.total_services || 0);

    const grossProfit = totalRevenue - totalCogs;

    const marginPercent =
      totalRevenue > 0
        ? (grossProfit / totalRevenue) * 100
        : 0;

    // ============================================================
    // SHAPE CATEGORIES
    // ============================================================

    const categories = categoryRows.map((category) => {
      const categoryRevenue = Number(
        category.total_revenue || 0,
      );

      return {
        category_id: category.category_id,
        category_name: category.category_name,

        total_revenue: Number(
          categoryRevenue.toFixed(2),
        ),

        total_units: Number(
          category.total_units || 0,
        ),

        share_percent:
          totalRevenue > 0
            ? Number(
                (
                  (categoryRevenue / totalRevenue) *
                  100
                ).toFixed(1),
              )
            : 0,
      };
    });

    // ============================================================
    // SHAPE TOP SERVICES
    // ============================================================

    const topServices = serviceRows.map((service) => {
      const serviceRevenue = Number(
        service.total_revenue || 0,
      );

      const serviceCogs = Number(
        service.total_cogs || 0,
      );

      const serviceProfit =
        serviceRevenue - serviceCogs;

      const serviceMargin =
        serviceRevenue > 0
          ? (serviceProfit / serviceRevenue) * 100
          : 0;

      return {
        product_id: service.product_id,
        product_name: service.product_name,
        category_name: service.category_name,

        total_units: Number(
          service.total_units || 0,
        ),

        total_revenue: Number(
          serviceRevenue.toFixed(2),
        ),

        total_cogs: Number(
          serviceCogs.toFixed(2),
        ),

        profit: Number(
          serviceProfit.toFixed(2),
        ),

        margin_percent: Number(
          serviceMargin.toFixed(1),
        ),
      };
    });

    // ============================================================
    // SHAPE TREND
    // ============================================================

    const trend = trendRows.map((entry) => ({
      date: entry.date,
      total: Number(
        Number(entry.total || 0).toFixed(2),
      ),
    }));

    return {
      summary: {
        total_revenue: Number(
          totalRevenue.toFixed(2),
        ),

        total_cogs: Number(
          totalCogs.toFixed(2),
        ),

        profit: Number(
          grossProfit.toFixed(2),
        ),

        margin_percent: Number(
          marginPercent.toFixed(1),
        ),

        total_units: totalUnits,
        total_services: totalServices,
      },

      categories,

      top_services: topServices,

      trend,
    };
  }
}

export default new StoreSalesByServiceReportService();






// import { prisma } from "../prisma/client.js";

// class StoreSalesByServiceReportService {
//   async salesByService(owner_id, { from, to } = {}) {
//     const startDate = from ? new Date(from) : null;
//     const endDate   = to   ? (() => { const d = new Date(to); d.setHours(23,59,59,999); return d; })() : null;

//     const [summaryRows, categoryRows, serviceRows, trendRows] = await Promise.all([

//       // ── Summary totals ──────────────────────────────────────────────────
//       startDate && endDate
//         ? prisma.$queryRaw`
//             SELECT
//               COALESCE(SUM(ssi.line_total), 0)::numeric  AS total_revenue,
//               COALESCE(SUM(ssi.qty), 0)::int             AS total_units,
//               COUNT(DISTINCT ssi.product_id)::int        AS total_services
//             FROM store_sales_items ssi
//             JOIN store_sales ss ON ss.sales_id = ssi.sales_id
//             JOIN store_products p ON p.product_id = ssi.product_id
//             WHERE ss.owner_id = ${owner_id}
//               AND p.type = 'service'
//               AND ss.created_at >= ${startDate}
//               AND ss.created_at <= ${endDate}
//           `
//         : prisma.$queryRaw`
//             SELECT
//               COALESCE(SUM(ssi.line_total), 0)::numeric  AS total_revenue,
//               COALESCE(SUM(ssi.qty), 0)::int             AS total_units,
//               COUNT(DISTINCT ssi.product_id)::int        AS total_services
//             FROM store_sales_items ssi
//             JOIN store_sales ss ON ss.sales_id = ssi.sales_id
//             JOIN store_products p ON p.product_id = ssi.product_id
//             WHERE ss.owner_id = ${owner_id}
//               AND p.type = 'service'
//           `,

//       // ── By category ────────────────────────────────────────────────────
//       startDate && endDate
//         ? prisma.$queryRaw`
//             SELECT
//               COALESCE(c.category_id::text, '__uncat__')  AS category_id,
//               COALESCE(c.category_name, 'Uncategorized')  AS category_name,
//               SUM(ssi.line_total)::numeric                AS total_revenue,
//               SUM(ssi.qty)::int                           AS total_units
//             FROM store_sales_items ssi
//             JOIN store_sales ss ON ss.sales_id = ssi.sales_id
//             JOIN store_products p ON p.product_id = ssi.product_id
//             LEFT JOIN store_categories c ON c.category_id = p.category_id
//             WHERE ss.owner_id = ${owner_id}
//               AND p.type = 'service'
//               AND ss.created_at >= ${startDate}
//               AND ss.created_at <= ${endDate}
//             GROUP BY c.category_id, c.category_name
//             ORDER BY total_revenue DESC
//           `
//         : prisma.$queryRaw`
//             SELECT
//               COALESCE(c.category_id::text, '__uncat__')  AS category_id,
//               COALESCE(c.category_name, 'Uncategorized')  AS category_name,
//               SUM(ssi.line_total)::numeric                AS total_revenue,
//               SUM(ssi.qty)::int                           AS total_units
//             FROM store_sales_items ssi
//             JOIN store_sales ss ON ss.sales_id = ssi.sales_id
//             JOIN store_products p ON p.product_id = ssi.product_id
//             LEFT JOIN store_categories c ON c.category_id = p.category_id
//             WHERE ss.owner_id = ${owner_id}
//               AND p.type = 'service'
//             GROUP BY c.category_id, c.category_name
//             ORDER BY total_revenue DESC
//           `,

//       // ── By service product (top 10) ─────────────────────────────────────
//       startDate && endDate
//         ? prisma.$queryRaw`
//             SELECT
//               p.product_id,
//               p.product_name,
//               COALESCE(c.category_name, 'Uncategorized') AS category_name,
//               COALESCE(p.cp, 0)::numeric                 AS cp,
//               COALESCE(p.sp, 0)::numeric                 AS sp,
//               SUM(ssi.line_total)::numeric                AS total_revenue,
//               SUM(ssi.qty)::int                           AS total_units
//             FROM store_sales_items ssi
//             JOIN store_sales ss ON ss.sales_id = ssi.sales_id
//             JOIN store_products p ON p.product_id = ssi.product_id
//             LEFT JOIN store_categories c ON c.category_id = p.category_id
//             WHERE ss.owner_id = ${owner_id}
//               AND p.type = 'service'
//               AND ss.created_at >= ${startDate}
//               AND ss.created_at <= ${endDate}
//             GROUP BY p.product_id, p.product_name, c.category_name, p.cp, p.sp
//             ORDER BY total_revenue DESC
//             LIMIT 10
//           `
//         : prisma.$queryRaw`
//             SELECT
//               p.product_id,
//               p.product_name,
//               COALESCE(c.category_name, 'Uncategorized') AS category_name,
//               COALESCE(p.cp, 0)::numeric                 AS cp,
//               COALESCE(p.sp, 0)::numeric                 AS sp,
//               SUM(ssi.line_total)::numeric                AS total_revenue,
//               SUM(ssi.qty)::int                           AS total_units
//             FROM store_sales_items ssi
//             JOIN store_sales ss ON ss.sales_id = ssi.sales_id
//             JOIN store_products p ON p.product_id = ssi.product_id
//             LEFT JOIN store_categories c ON c.category_id = p.category_id
//             WHERE ss.owner_id = ${owner_id}
//               AND p.type = 'service'
//             GROUP BY p.product_id, p.product_name, c.category_name, p.cp, p.sp
//             ORDER BY total_revenue DESC
//             LIMIT 10
//           `,

//       // ── Daily trend ────────────────────────────────────────────────────
//       startDate && endDate
//         ? prisma.$queryRaw`
//             SELECT
//               DATE(ss.created_at)::text    AS date,
//               SUM(ssi.line_total)::numeric  AS total
//             FROM store_sales_items ssi
//             JOIN store_sales ss ON ss.sales_id = ssi.sales_id
//             JOIN store_products p ON p.product_id = ssi.product_id
//             WHERE ss.owner_id = ${owner_id}
//               AND p.type = 'service'
//               AND ss.created_at >= ${startDate}
//               AND ss.created_at <= ${endDate}
//             GROUP BY DATE(ss.created_at)
//             ORDER BY date ASC
//           `
//         : prisma.$queryRaw`
//             SELECT
//               DATE(ss.created_at)::text    AS date,
//               SUM(ssi.line_total)::numeric  AS total
//             FROM store_sales_items ssi
//             JOIN store_sales ss ON ss.sales_id = ssi.sales_id
//             JOIN store_products p ON p.product_id = ssi.product_id
//             WHERE ss.owner_id = ${owner_id}
//               AND p.type = 'service'
//             GROUP BY DATE(ss.created_at)
//             ORDER BY date ASC
//           `,
//     ]);

//     const sr = summaryRows[0] || {};
//     const totalRevenue = Number(sr.total_revenue || 0);

//     const categories = categoryRows.map((c) => ({
//       category_id:    c.category_id,
//       category_name:  c.category_name,
//       total_revenue:  Number(c.total_revenue),
//       total_units:    Number(c.total_units),
//       share_percent:  totalRevenue > 0
//         ? Number(((Number(c.total_revenue) / totalRevenue) * 100).toFixed(1))
//         : 0,
//     }));

//     const top_services = serviceRows.map((s) => {
//       const rev    = Number(s.total_revenue);
//       const cp     = Number(s.cp);
//       const sp     = Number(s.sp);
//       const profit = cp > 0 ? rev - cp * Number(s.total_units) : rev; // pure revenue if no cp
//       const margin = sp > 0 ? ((sp - cp) / sp) * 100 : 100;
//       return {
//         product_id:    s.product_id,
//         product_name:  s.product_name,
//         category_name: s.category_name,
//         cp,
//         sp,
//         total_units:   Number(s.total_units),
//         total_revenue: Number(rev.toFixed(2)),
//         profit:        Number(profit.toFixed(2)),
//         margin_percent: Number(margin.toFixed(1)),
//       };
//     });

//     const trend = trendRows.map((t) => ({
//       date:  t.date,
//       total: Number(Number(t.total).toFixed(2)),
//     }));

//     return {
//       summary: {
//         total_revenue:   Number(totalRevenue.toFixed(2)),
//         total_units:     Number(sr.total_units || 0),
//         total_services:  Number(sr.total_services || 0),
//       },
//       categories,
//       top_services,
//       trend,
//     };
//   }
// }

// export default new StoreSalesByServiceReportService();
