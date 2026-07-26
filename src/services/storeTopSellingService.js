// src/services/storeTopSellingService.js
import { prisma } from "../prisma/client.js";

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

// Simple in-memory cache — 60s TTL (TEMPORARILY DISABLED FOR TESTING)
const cache = new Map();
const CACHE_TTL_MS = 0; // Set to 0 to disable cache

function cacheKey(owner_id, from, to) {
  return `${owner_id}:${from ?? ""}:${to ?? ""}`;
}

class StoreTopSellingService {
  async getReport(owner_id, { from, to } = {}) {
    const key = cacheKey(owner_id, from, to);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return cached.data;
    }

    const startDate = from ? new Date(from) : null;
    const endDate = to
      ? (() => {
          const d = new Date(to);
          d.setHours(23, 59, 59, 999);
          return d;
        })()
      : null;

    // Previous period for growth comparison
    // Previous period with the same number of days.
    let prevStart = null;
    let prevEnd = null;

    if (startDate && endDate) {
      const dayMs = 24 * 60 * 60 * 1000;

      const periodDays =
        Math.floor((endDate.getTime() - startDate.getTime()) / dayMs) + 1;

      prevEnd = new Date(startDate.getTime() - 1);

      prevStart = new Date(prevEnd);

      prevStart.setDate(prevStart.getDate() - (periodDays - 1));

      prevStart.setHours(0, 0, 0, 0);
    }

    // ── All queries in parallel ─────────────────────────────────────────────
    const [
      topRows,
      returnRows,
      stockRows,
      prevRows,
      trendRawRows,
      previousTrendRawRows,
    ] = await Promise.all([
      // Top products by net revenue (DB-side aggregation)
      // Uses SP * qty instead of line_total to match sales by item report
      startDate && endDate
        ? prisma.$queryRaw`
            SELECT
              p.product_id,
              p.product_name,
              COALESCE(c.category_name, 'Uncategorized') AS category_name,
              COALESCE(c.category_id::text, null)        AS category_id,
              COALESCE(u.unit_name, 'pcs')               AS unit_name,
              COALESCE(p.cp, 0)::numeric                 AS cp,
              COALESCE(p.sp, 0)::numeric                 AS sp,
              SUM(ssi.qty)::int                          AS qty_sold,
              SUM(
                ssi.sp * ssi.qty * 
                CASE 
                  WHEN ss.total_amount > 0 
                  THEN (1 - COALESCE(ss.discount, 0) / ss.total_amount)
                  ELSE 1
                END
              )::numeric AS revenue
            FROM store_sales_items ssi
            JOIN store_sales ss ON ss.sales_id = ssi.sales_id
            JOIN store_products p ON p.product_id = ssi.product_id
            LEFT JOIN store_categories c ON c.category_id = p.category_id
            LEFT JOIN store_units u ON u.unit_id = p.unit_id
            WHERE ss.owner_id = ${owner_id}
              AND p.type = 'item'
              AND ss.created_at >= ${startDate}
              AND ss.created_at <= ${endDate}
            GROUP BY p.product_id, p.product_name, c.category_name, c.category_id, u.unit_name, p.cp, p.sp
            ORDER BY revenue DESC
            LIMIT 10
          `
        : prisma.$queryRaw`
            SELECT
              p.product_id,
              p.product_name,
              COALESCE(c.category_name, 'Uncategorized') AS category_name,
              COALESCE(c.category_id::text, null)        AS category_id,
              COALESCE(u.unit_name, 'pcs')               AS unit_name,
              COALESCE(p.cp, 0)::numeric                 AS cp,
              COALESCE(p.sp, 0)::numeric                 AS sp,
              SUM(ssi.qty)::int                          AS qty_sold,
              SUM(
                ssi.sp * ssi.qty * 
                CASE 
                  WHEN ss.total_amount > 0 
                  THEN (1 - COALESCE(ss.discount, 0) / ss.total_amount)
                  ELSE 1
                END
              )::numeric AS revenue
            FROM store_sales_items ssi
            JOIN store_sales ss ON ss.sales_id = ssi.sales_id
            JOIN store_products p ON p.product_id = ssi.product_id
            LEFT JOIN store_categories c ON c.category_id = p.category_id
            LEFT JOIN store_units u ON u.unit_id = p.unit_id
            WHERE ss.owner_id = ${owner_id}
              AND p.type = 'item'
            GROUP BY p.product_id, p.product_name, c.category_name, c.category_id, u.unit_name, p.cp, p.sp
            ORDER BY revenue DESC
            LIMIT 10
          `,

      // Returns for those products in the same period (with discount allocation)
      startDate && endDate
        ? prisma.$queryRaw`
            SELECT
              ssi.product_id,
              SUM(scri.qty)::int AS refunded_qty,
              SUM(
                ssi.sp * scri.qty * 
                CASE 
                  WHEN ss.total_amount > 0 
                  THEN (1 - COALESCE(ss.discount, 0) / ss.total_amount)
                  ELSE 1
                END
              )::numeric AS refund_amount
            FROM store_customer_return_items scri
            JOIN store_customer_returns scr ON scr.return_id = scri.return_id
            JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
            JOIN store_sales ss ON ss.sales_id = ssi.sales_id
            JOIN store_products p ON p.product_id = ssi.product_id
            WHERE scr.owner_id = ${owner_id}
              AND p.type = 'item'
              AND scr.created_at >= ${startDate}
              AND scr.created_at <= ${endDate}
            GROUP BY ssi.product_id
          `
        : prisma.$queryRaw`
            SELECT
              ssi.product_id,
              SUM(scri.qty)::int AS refunded_qty,
              SUM(
                ssi.sp * scri.qty * 
                CASE 
                  WHEN ss.total_amount > 0 
                  THEN (1 - COALESCE(ss.discount, 0) / ss.total_amount)
                  ELSE 1
                END
              )::numeric AS refund_amount
            FROM store_customer_return_items scri
            JOIN store_customer_returns scr ON scr.return_id = scri.return_id
            JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
            JOIN store_sales ss ON ss.sales_id = ssi.sales_id
            JOIN store_products p ON p.product_id = ssi.product_id
            WHERE scr.owner_id = ${owner_id}
              AND p.type = 'item'
            GROUP BY ssi.product_id
          `,

      // Current stock per product
      prisma.$queryRaw`
        SELECT product_id, COALESCE(SUM(qty_remaining), 0)::int AS stock
        FROM store_stock_lots
        WHERE owner_id = ${owner_id}
        GROUP BY product_id
      `,

      // Previous period totals (for growth) - with discount allocation
      prevStart && prevEnd
        ? prisma.$queryRaw`
            SELECT
              COALESCE(
                SUM(
                  ssi.sp * ssi.qty * 
                  CASE 
                    WHEN ss.total_amount > 0 
                    THEN (1 - COALESCE(ss.discount, 0) / ss.total_amount)
                    ELSE 1
                  END
                ), 0
              )::numeric AS prev_revenue,
              COALESCE(SUM(ssi.qty), 0)::int AS prev_qty
            FROM store_sales_items ssi
            JOIN store_sales ss ON ss.sales_id = ssi.sales_id
            JOIN store_products p ON p.product_id = ssi.product_id
            WHERE ss.owner_id = ${owner_id}
              AND p.type = 'item'
              AND ss.created_at >= ${prevStart}
              AND ss.created_at <= ${prevEnd}
          `
        : Promise.resolve([{ prev_revenue: 0, prev_qty: 0 }]),

      // Current-period daily quantity and revenue.
      // generate_series creates rows for dates with no sales.
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
            SUM(ssi.sp * ssi.qty),
            0
          )::numeric AS revenue
        FROM store_sales_items ssi
        JOIN store_sales ss
          ON ss.sales_id = ssi.sales_id
        JOIN store_products p
          ON p.product_id = ssi.product_id
        WHERE ss.owner_id = ${owner_id}
          AND p.type = 'item'
          AND ss.created_at >= ${startDate}
          AND ss.created_at <= ${endDate}
        GROUP BY DATE(ss.created_at)
      ),

      returns_daily AS (
        SELECT
          DATE(scr.created_at) AS day,
          COALESCE(
            SUM(scri.qty),
            0
          )::numeric AS qty,
          COALESCE(
            SUM(ssi.sp * scri.qty),
            0
          )::numeric AS revenue
        FROM store_customer_return_items scri
        JOIN store_customer_returns scr
          ON scr.return_id = scri.return_id
        JOIN store_sales_items ssi
          ON ssi.sales_item_id =
             scri.sales_item_id
        JOIN store_products p
          ON p.product_id = ssi.product_id
        WHERE scr.owner_id = ${owner_id}
          AND p.type = 'item'
          AND scr.created_at >= ${startDate}
          AND scr.created_at <= ${endDate}
        GROUP BY DATE(scr.created_at)
      )

      SELECT
        TO_CHAR(
          d.day,
          'YYYY-MM-DD'
        ) AS day,

        GREATEST(
          COALESCE(s.qty, 0) -
          COALESCE(r.qty, 0),
          0
        )::int AS qty,

        GREATEST(
          COALESCE(s.revenue, 0) -
          COALESCE(r.revenue, 0),
          0
        )::numeric AS revenue

      FROM days d

      LEFT JOIN sales_daily s
        ON s.day = d.day

      LEFT JOIN returns_daily r
        ON r.day = d.day

      ORDER BY d.day ASC
    `
        : Promise.resolve([]),

      // Previous-period daily quantity and revenue.
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
            SUM(ssi.sp * ssi.qty),
            0
          )::numeric AS revenue
        FROM store_sales_items ssi
        JOIN store_sales ss
          ON ss.sales_id = ssi.sales_id
        JOIN store_products p
          ON p.product_id = ssi.product_id
        WHERE ss.owner_id = ${owner_id}
          AND p.type = 'item'
          AND ss.created_at >= ${prevStart}
          AND ss.created_at <= ${prevEnd}
        GROUP BY DATE(ss.created_at)
      ),

      returns_daily AS (
        SELECT
          DATE(scr.created_at) AS day,
          COALESCE(
            SUM(scri.qty),
            0
          )::numeric AS qty,
          COALESCE(
            SUM(ssi.sp * scri.qty),
            0
          )::numeric AS revenue
        FROM store_customer_return_items scri
        JOIN store_customer_returns scr
          ON scr.return_id = scri.return_id
        JOIN store_sales_items ssi
          ON ssi.sales_item_id =
             scri.sales_item_id
        JOIN store_products p
          ON p.product_id = ssi.product_id
        WHERE scr.owner_id = ${owner_id}
          AND p.type = 'item'
          AND scr.created_at >= ${prevStart}
          AND scr.created_at <= ${prevEnd}
        GROUP BY DATE(scr.created_at)
      )

      SELECT
        TO_CHAR(
          d.day,
          'YYYY-MM-DD'
        ) AS day,

        GREATEST(
          COALESCE(s.qty, 0) -
          COALESCE(r.qty, 0),
          0
        )::int AS qty,

        GREATEST(
          COALESCE(s.revenue, 0) -
          COALESCE(r.revenue, 0),
          0
        )::numeric AS revenue

      FROM days d

      LEFT JOIN sales_daily s
        ON s.day = d.day

      LEFT JOIN returns_daily r
        ON r.day = d.day

      ORDER BY d.day ASC
    `
        : Promise.resolve([]),

      // Total discount given in the period (for summary card)
      startDate && endDate
        ? prisma.$queryRaw`
            SELECT COALESCE(SUM(discount), 0)::numeric AS total_discount
            FROM store_sales
            WHERE owner_id = ${owner_id}
              AND created_at >= ${startDate}
              AND created_at <= ${endDate}
          `
        : prisma.$queryRaw`
            SELECT COALESCE(SUM(discount), 0)::numeric AS total_discount
            FROM store_sales
            WHERE owner_id = ${owner_id}
          `,
    ]);

    // ── Build lookup maps ───────────────────────────────────────────────────
    const returnMap = new Map(returnRows.map((r) => [r.product_id, r]));
    const stockMap = new Map(
      stockRows.map((s) => [s.product_id, Number(s.stock)]),
    );

    const prevRevenue = Number(prevRows[0]?.prev_revenue || 0);
    const prevQty = Number(prevRows[0]?.prev_qty || 0);

    // ── Shape top products ──────────────────────────────────────────────────
    const products = topRows
      .map((p) => {
        const ret = returnMap.get(p.product_id);
        const refundedQty = Number(ret?.refunded_qty || 0);
        const refundAmt = Number(ret?.refund_amount || 0);
        const grossRev = Number(p.revenue);
        const netRev = grossRev - refundAmt;
        const netQty = Number(p.qty_sold) - refundedQty;
        const cp = Number(p.cp);
        const sp = Number(p.sp);
        const margin = sp > 0 ? ((sp - cp) / sp) * 100 : 0;

        return {
          product_id: p.product_id,
          product_name: p.product_name,
          category: p.category_name,
          category_id: p.category_id,
          unit: p.unit_name,
          cp,
          sp,
          qty_sold: netQty,
          revenue: Number(netRev.toFixed(2)),
          refunded_qty: refundedQty,
          refund_amount: Number(refundAmt.toFixed(2)),
          stock_remaining: stockMap.get(p.product_id) ?? 0,
          margin_percent: Number(margin.toFixed(1)),
        };
      })
      .filter((p) => p.qty_sold > 0)
      .sort((a, b) => b.revenue - a.revenue);

    // ── Summary KPIs ────────────────────────────────────────────────────────
    const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);
    const totalQty = products.reduce((s, p) => s + p.qty_sold, 0);
    const avgMargin =
      totalRevenue > 0
        ? products.reduce((s, p) => s + p.margin_percent * p.revenue, 0) /
          totalRevenue
        : 0;
    const bestSeller = products[0] ?? null;
    const growthPct =
      prevRevenue > 0
        ? Number(
            (((totalRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1),
          )
        : 0;
    const qtyGrowth =
      prevQty > 0
        ? Number((((totalQty - prevQty) / prevQty) * 100).toFixed(1))
        : 0;

    // ── Category breakdown ───────────────────────────────────────────────────
    const catMap = new Map();
    for (const p of products) {
      catMap.set(p.category, (catMap.get(p.category) ?? 0) + p.revenue);
    }
    const catTotal = [...catMap.values()].reduce((s, v) => s + v, 0);
    const categories = [...catMap.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([name, total]) => ({
        name,
        total: Number(total.toFixed(2)),
        pct: catTotal > 0 ? Number(((total / catTotal) * 100).toFixed(1)) : 0,
      }));

    // ── Daily trend ──────────────────────────────────────────────────────────
    const trend = trendRawRows.map((row, index) => {
      const previousRow = previousTrendRawRows[index];

      const currentRevenue = Number(row.revenue || 0);

      const previousRevenue = Number(previousRow?.revenue || 0);

      return {
        date: row.day,
        label: fmt(row.day),

        qty: Number(row.qty || 0),

        revenue: Number(currentRevenue.toFixed(2)),

        previous_date: previousRow?.day ?? null,

        previous_label: previousRow?.day ? fmt(previousRow.day) : null,

        previous_qty: Number(previousRow?.qty || 0),

        previous_revenue: Number(previousRevenue.toFixed(2)),
      };
    });

    const result = {
      summary: {
        total_revenue: Number(totalRevenue.toFixed(2)),
        total_qty_sold: totalQty,
        avg_margin: Number(avgMargin.toFixed(1)),
        best_seller: bestSeller?.product_name ?? null,
        best_seller_qty: bestSeller?.qty_sold ?? 0,
        growth_percent: growthPct,
        qty_growth: qtyGrowth,
      },
      products,
      trend,
      categories,
    };

    cache.set(key, { ts: Date.now(), data: result });
    return result;
  }

  // Call this after a sale or return is created to invalidate cached reports
  invalidate(owner_id) {
    for (const k of cache.keys()) {
      if (k.startsWith(`${owner_id}:`)) cache.delete(k);
    }
  }
}

export default new StoreTopSellingService();
