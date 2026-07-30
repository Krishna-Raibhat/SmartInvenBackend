// src/services/storeTopSellingService.js
// src/services/storeTopSellingService.js
import { prisma } from "../prisma/client.js";
import { startOfDayNPT, endOfDayNPT } from "../utils/nptTime.js";

const fmt = (iso) => {
  const d = new Date(iso);

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
};

// In-memory report cache.
// Set CACHE_TTL_MS above 0 when you want to enable caching.
const cache = new Map();
const CACHE_TTL_MS = 0;

function cacheKey(ownerId, from, to) {
  return `${ownerId}:${from ?? ""}:${to ?? ""}`;
}

class StoreTopSellingService {
  async getReport(ownerId, { from, to } = {}) {
    const key = cacheKey(ownerId, from, to);
    const cached = cache.get(key);

    if (
      CACHE_TTL_MS > 0 &&
      cached &&
      Date.now() - cached.ts < CACHE_TTL_MS
    ) {
      return cached.data;
    }

    // const startDate = from ? new Date(from) : null;

    // const endDate = to
    //   ? (() => {
    //       const date = new Date(to);
    //       date.setHours(23, 59, 59, 999);
    //       return date;
    //     })()
    //   : null;

    // // Previous period with the same number of days.
    // let prevStart = null;
    // let prevEnd = null;

    // if (startDate && endDate) {
    //   const dayMs = 24 * 60 * 60 * 1000;

    //   const periodDays =
    //     Math.floor((endDate.getTime() - startDate.getTime()) / dayMs) + 1;

    //   prevEnd = new Date(startDate.getTime() - 1);

    //   prevStart = new Date(prevEnd);
    //   prevStart.setDate(prevStart.getDate() - (periodDays - 1));
    //   prevStart.setHours(0, 0, 0, 0);
    // }
    const startDate = from ? startOfDayNPT(new Date(from)) : null;

    const endDate = to ? endOfDayNPT(new Date(to)) : null;

    // Previous period with the same number of days.
    let prevStart = null;
    let prevEnd = null;

    if (startDate && endDate) {
      const dayMs = 24 * 60 * 60 * 1000;

      const periodDays =
        Math.floor((endDate.getTime() - startDate.getTime()) / dayMs) + 1;

      prevEnd = new Date(startDate.getTime() - 1);
      prevStart = startOfDayNPT(new Date(prevEnd.getTime() - (periodDays - 1) * dayMs));
    }
    const [
      topRows,
      returnRows,
      stockRows,
      prevRows,
      trendRawRows,
      previousTrendRawRows,
    ] = await Promise.all([
      // ─────────────────────────────────────────────────────────────────────
      // Top products
      //
      // Revenue = original item selling price × original quantity sold.
      // Discounts and customer returns do not reduce this revenue.
      // ─────────────────────────────────────────────────────────────────────
      startDate && endDate
        ? prisma.$queryRaw`
            SELECT
              p.product_id,
              p.product_name,

              COALESCE(
                c.category_name,
                'Uncategorized'
              ) AS category_name,

              c.category_id::text AS category_id,

              COALESCE(
                u.unit_name,
                'pcs'
              ) AS unit_name,

              COALESCE(
                p.cp,
                0
              )::numeric AS cp,

              COALESCE(
                p.sp,
                0
              )::numeric AS sp,

              COALESCE(
                SUM(ssi.qty),
                0
              )::int AS qty_sold,

              COALESCE(
                SUM(
                  COALESCE(ssi.sp, 0) * ssi.qty
                ),
                0
              )::numeric AS revenue

            FROM store_sales_items ssi

            JOIN store_sales ss
              ON ss.sales_id = ssi.sales_id

            JOIN store_products p
              ON p.product_id = ssi.product_id

            LEFT JOIN store_categories c
              ON c.category_id = p.category_id

            LEFT JOIN store_units u
              ON u.unit_id = p.unit_id

            WHERE ss.owner_id = ${ownerId}
              AND p.type = 'item'
              AND ss.created_at >= ${startDate}
              AND ss.created_at <= ${endDate}

            GROUP BY
              p.product_id,
              p.product_name,
              c.category_name,
              c.category_id,
              u.unit_name,
              p.cp,
              p.sp

            ORDER BY revenue DESC

            LIMIT 10
          `
        : prisma.$queryRaw`
            SELECT
              p.product_id,
              p.product_name,

              COALESCE(
                c.category_name,
                'Uncategorized'
              ) AS category_name,

              c.category_id::text AS category_id,

              COALESCE(
                u.unit_name,
                'pcs'
              ) AS unit_name,

              COALESCE(
                p.cp,
                0
              )::numeric AS cp,

              COALESCE(
                p.sp,
                0
              )::numeric AS sp,

              COALESCE(
                SUM(ssi.qty),
                0
              )::int AS qty_sold,

              COALESCE(
                SUM(
                  COALESCE(ssi.sp, 0) * ssi.qty
                ),
                0
              )::numeric AS revenue

            FROM store_sales_items ssi

            JOIN store_sales ss
              ON ss.sales_id = ssi.sales_id

            JOIN store_products p
              ON p.product_id = ssi.product_id

            LEFT JOIN store_categories c
              ON c.category_id = p.category_id

            LEFT JOIN store_units u
              ON u.unit_id = p.unit_id

            WHERE ss.owner_id = ${ownerId}
              AND p.type = 'item'

            GROUP BY
              p.product_id,
              p.product_name,
              c.category_name,
              c.category_id,
              u.unit_name,
              p.cp,
              p.sp

            ORDER BY revenue DESC

            LIMIT 10
          `,

      // ─────────────────────────────────────────────────────────────────────
      // Customer returns
      //
      // These values are informational only.
      // They do not reduce qty_sold or revenue in this report.
      // ─────────────────────────────────────────────────────────────────────
      startDate && endDate
        ? prisma.$queryRaw`
            SELECT
              ssi.product_id,

              COALESCE(
                SUM(scri.qty),
                0
              )::int AS refunded_qty,

              COALESCE(
                SUM(
                  COALESCE(ssi.sp, 0) * scri.qty
                ),
                0
              )::numeric AS refund_amount

            FROM store_customer_return_items scri

            JOIN store_customer_returns scr
              ON scr.return_id = scri.return_id

            JOIN store_sales_items ssi
              ON ssi.sales_item_id = scri.sales_item_id

            JOIN store_products p
              ON p.product_id = ssi.product_id

            WHERE scr.owner_id = ${ownerId}
              AND p.type = 'item'
              AND scr.created_at >= ${startDate}
              AND scr.created_at <= ${endDate}

            GROUP BY ssi.product_id
          `
        : prisma.$queryRaw`
            SELECT
              ssi.product_id,

              COALESCE(
                SUM(scri.qty),
                0
              )::int AS refunded_qty,

              COALESCE(
                SUM(
                  COALESCE(ssi.sp, 0) * scri.qty
                ),
                0
              )::numeric AS refund_amount

            FROM store_customer_return_items scri

            JOIN store_customer_returns scr
              ON scr.return_id = scri.return_id

            JOIN store_sales_items ssi
              ON ssi.sales_item_id = scri.sales_item_id

            JOIN store_products p
              ON p.product_id = ssi.product_id

            WHERE scr.owner_id = ${ownerId}
              AND p.type = 'item'

            GROUP BY ssi.product_id
          `,

      // ─────────────────────────────────────────────────────────────────────
      // Current stock
      // ─────────────────────────────────────────────────────────────────────
      prisma.$queryRaw`
        SELECT
          product_id,

          COALESCE(
            SUM(qty_remaining),
            0
          )::int AS stock

        FROM store_stock_lots

        WHERE owner_id = ${ownerId}

        GROUP BY product_id
      `,

      // ─────────────────────────────────────────────────────────────────────
      // Previous-period totals for growth comparison.
      //
      // Uses the same gross item-sales calculation as the current period.
      // ─────────────────────────────────────────────────────────────────────
      prevStart && prevEnd
        ? prisma.$queryRaw`
            SELECT
              COALESCE(
                SUM(
                  COALESCE(ssi.sp, 0) * ssi.qty
                ),
                0
              )::numeric AS prev_revenue,

              COALESCE(
                SUM(ssi.qty),
                0
              )::int AS prev_qty

            FROM store_sales_items ssi

            JOIN store_sales ss
              ON ss.sales_id = ssi.sales_id

            JOIN store_products p
              ON p.product_id = ssi.product_id

            WHERE ss.owner_id = ${ownerId}
              AND p.type = 'item'
              AND ss.created_at >= ${prevStart}
              AND ss.created_at <= ${prevEnd}
          `
        : Promise.resolve([
            {
              prev_revenue: 0,
              prev_qty: 0,
            },
          ]),

      // ─────────────────────────────────────────────────────────────────────
      // Current-period trend.
      //
      // Returns and discounts are not subtracted.
      // ─────────────────────────────────────────────────────────────────────
      startDate && endDate
        ? prisma.$queryRaw`
            WITH days AS (
              SELECT
                generate_series(
                  DATE(${startDate}),
                  DATE(${endDate}),
                  INTERVAL '1 day'
                )::date AS day
            ),

            sales_daily AS (
              SELECT
                DATE(ss.created_at) AS day,

                COALESCE(
                  SUM(ssi.qty),
                  0
                )::numeric AS qty,

                COALESCE(
                  SUM(
                    COALESCE(ssi.sp, 0) * ssi.qty
                  ),
                  0
                )::numeric AS revenue

              FROM store_sales_items ssi

              JOIN store_sales ss
                ON ss.sales_id = ssi.sales_id

              JOIN store_products p
                ON p.product_id = ssi.product_id

              WHERE ss.owner_id = ${ownerId}
                AND p.type = 'item'
                AND ss.created_at >= ${startDate}
                AND ss.created_at <= ${endDate}

              GROUP BY DATE(ss.created_at)
            )

            SELECT
              TO_CHAR(
                d.day,
                'YYYY-MM-DD'
              ) AS day,

              COALESCE(
                s.qty,
                0
              )::int AS qty,

              COALESCE(
                s.revenue,
                0
              )::numeric AS revenue

            FROM days d

            LEFT JOIN sales_daily s
              ON s.day = d.day

            ORDER BY d.day ASC
          `
        : Promise.resolve([]),

      // ─────────────────────────────────────────────────────────────────────
      // Previous-period trend.
      //
      // Returns and discounts are not subtracted.
      // ─────────────────────────────────────────────────────────────────────
      prevStart && prevEnd
        ? prisma.$queryRaw`
            WITH days AS (
              SELECT
                generate_series(
                  DATE(${prevStart}),
                  DATE(${prevEnd}),
                  INTERVAL '1 day'
                )::date AS day
            ),

            sales_daily AS (
              SELECT
                DATE(ss.created_at) AS day,

                COALESCE(
                  SUM(ssi.qty),
                  0
                )::numeric AS qty,

                COALESCE(
                  SUM(
                    COALESCE(ssi.sp, 0) * ssi.qty
                  ),
                  0
                )::numeric AS revenue

              FROM store_sales_items ssi

              JOIN store_sales ss
                ON ss.sales_id = ssi.sales_id

              JOIN store_products p
                ON p.product_id = ssi.product_id

              WHERE ss.owner_id = ${ownerId}
                AND p.type = 'item'
                AND ss.created_at >= ${prevStart}
                AND ss.created_at <= ${prevEnd}

              GROUP BY DATE(ss.created_at)
            )

            SELECT
              TO_CHAR(
                d.day,
                'YYYY-MM-DD'
              ) AS day,

              COALESCE(
                s.qty,
                0
              )::int AS qty,

              COALESCE(
                s.revenue,
                0
              )::numeric AS revenue

            FROM days d

            LEFT JOIN sales_daily s
              ON s.day = d.day

            ORDER BY d.day ASC
          `
        : Promise.resolve([]),
    ]);

    // ───────────────────────────────────────────────────────────────────────
    // Lookup maps
    // ───────────────────────────────────────────────────────────────────────
    const returnMap = new Map(
      returnRows.map((row) => [row.product_id, row]),
    );

    const stockMap = new Map(
      stockRows.map((row) => [
        row.product_id,
        Number(row.stock || 0),
      ]),
    );

    const previousRevenue = Number(
      prevRows[0]?.prev_revenue || 0,
    );

    const previousQty = Number(
      prevRows[0]?.prev_qty || 0,
    );

    // ───────────────────────────────────────────────────────────────────────
    // Product response
    // ───────────────────────────────────────────────────────────────────────
    const products = topRows
      .map((row) => {
        const returnData = returnMap.get(row.product_id);

        const refundedQty = Number(
          returnData?.refunded_qty || 0,
        );

        const refundAmount = Number(
          returnData?.refund_amount || 0,
        );

        const originalQtySold = Number(
          row.qty_sold || 0,
        );

        const grossRevenue = Number(
          row.revenue || 0,
        );

        const cp = Number(row.cp || 0);
        const sp = Number(row.sp || 0);

        const marginPercent =
          sp > 0 ? ((sp - cp) / sp) * 100 : 0;

        return {
          product_id: row.product_id,
          product_name: row.product_name,

          category: row.category_name,
          category_id: row.category_id,

          unit: row.unit_name,

          cp,
          sp,

          // Original sales figures.
          qty_sold: originalQtySold,
          revenue: Number(grossRevenue.toFixed(2)),

          // Informational return figures.
          refunded_qty: refundedQty,
          refund_amount: Number(refundAmount.toFixed(2)),

          stock_remaining:
            stockMap.get(row.product_id) ?? 0,

          margin_percent: Number(
            marginPercent.toFixed(1),
          ),
        };
      })
      .filter((product) => product.qty_sold > 0)
      .sort((a, b) => b.revenue - a.revenue);

    // ───────────────────────────────────────────────────────────────────────
    // Summary
    // ───────────────────────────────────────────────────────────────────────
    const totalRevenue = products.reduce(
      (sum, product) => sum + product.revenue,
      0,
    );

    const totalQty = products.reduce(
      (sum, product) => sum + product.qty_sold,
      0,
    );

    const averageMargin =
      totalRevenue > 0
        ? products.reduce(
            (sum, product) =>
              sum +
              product.margin_percent *
                product.revenue,
            0,
          ) / totalRevenue
        : 0;

    const bestSeller = products[0] ?? null;

    const growthPercent =
      previousRevenue > 0
        ? Number(
            (
              ((totalRevenue - previousRevenue) /
                previousRevenue) *
              100
            ).toFixed(1),
          )
        : 0;

    const qtyGrowth =
      previousQty > 0
        ? Number(
            (
              ((totalQty - previousQty) /
                previousQty) *
              100
            ).toFixed(1),
          )
        : 0;

    // ───────────────────────────────────────────────────────────────────────
    // Category breakdown
    // ───────────────────────────────────────────────────────────────────────
    const categoryMap = new Map();

    for (const product of products) {
      categoryMap.set(
        product.category,
        (categoryMap.get(product.category) ?? 0) +
          product.revenue,
      );
    }

    const categoryTotal = [...categoryMap.values()].reduce(
      (sum, value) => sum + value,
      0,
    );

    const categories = [...categoryMap.entries()]
      .sort(([, firstTotal], [, secondTotal]) => {
        return secondTotal - firstTotal;
      })
      .map(([name, total]) => ({
        name,
        total: Number(total.toFixed(2)),
        pct:
          categoryTotal > 0
            ? Number(
                ((total / categoryTotal) * 100).toFixed(1),
              )
            : 0,
      }));

    // ───────────────────────────────────────────────────────────────────────
    // Daily trend
    // ───────────────────────────────────────────────────────────────────────
    const trend = trendRawRows.map((row, index) => {
      const previousRow =
        previousTrendRawRows[index];

      const currentRevenue = Number(
        row.revenue || 0,
      );

      const previousPeriodRevenue = Number(
        previousRow?.revenue || 0,
      );

      return {
        date: row.day,
        label: fmt(row.day),

        qty: Number(row.qty || 0),
        revenue: Number(currentRevenue.toFixed(2)),

        previous_date: previousRow?.day ?? null,

        previous_label: previousRow?.day
          ? fmt(previousRow.day)
          : null,

        previous_qty: Number(
          previousRow?.qty || 0,
        ),

        previous_revenue: Number(
          previousPeriodRevenue.toFixed(2),
        ),
      };
    });

    const result = {
      summary: {
        total_revenue: Number(
          totalRevenue.toFixed(2),
        ),

        total_qty_sold: totalQty,

        avg_margin: Number(
          averageMargin.toFixed(1),
        ),

        best_seller:
          bestSeller?.product_name ?? null,

        best_seller_qty:
          bestSeller?.qty_sold ?? 0,

        growth_percent: growthPercent,
        qty_growth: qtyGrowth,
      },

      products,
      trend,
      categories,
    };

    if (CACHE_TTL_MS > 0) {
      cache.set(key, {
        ts: Date.now(),
        data: result,
      });
    }

    return result;
  }

  // Call after creating, updating, or deleting a sale or return.
  invalidate(ownerId) {
    for (const key of cache.keys()) {
      if (key.startsWith(`${ownerId}:`)) {
        cache.delete(key);
      }
    }
  }
}

export default new StoreTopSellingService();