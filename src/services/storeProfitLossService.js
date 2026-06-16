// src/services/storeProfitLossService.js
import { prisma } from "../prisma/client.js";

function parseDateOrNull(x) {
  if (!x) return null;
  const d = new Date(String(x));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function normalizeGroup(group) {
  const g = String(group || "day").toLowerCase();
  return ["day", "week", "month", "year"].includes(g) ? g : "day";
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

class StoreProfitLossService {
  /**
   * Summary: total revenue, cost, profit, discount, due, returns
   * - Items: profit = (sp - cp) * qty  (cp comes from the sales item)
   * - Services: profit = sp * qty  (no cp stored — pure service revenue)
   */
  async summary(owner_id, { start, end }) {
    const startFinal = startOfDay(parseDateOrNull(start) ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const endFinal   = endOfDay(parseDateOrNull(end) ?? new Date());

    const rows = await prisma.$queryRaw`
      WITH sold AS (
        SELECT
          ss.sales_id,
          GREATEST(ss.total_amount - COALESCE(ss.discount, 0), 0)        AS effective_total,
          ss.paid_amount,
          ss.discount,
          COALESCE(SUM(COALESCE(ssi.cp, 0) * ssi.qty), 0)                AS sold_cost,
          COALESCE(SUM(ssi.sp * ssi.qty), 0)                             AS sold_revenue
        FROM store_sales_items ssi
        JOIN store_sales ss ON ss.sales_id = ssi.sales_id
        WHERE ss.owner_id = ${owner_id}
          AND ss.created_at >= ${startFinal}
          AND ss.created_at <= ${endFinal}
        GROUP BY ss.sales_id, ss.total_amount, ss.discount, ss.paid_amount
      ),
      returns AS (
        SELECT
          scr.sales_id,
          COALESCE(SUM(scr.refund_amount), 0)           AS total_refund,
          COALESCE(SUM(
            COALESCE(ssi.cp, 0) * scri.qty
          ), 0)                                          AS returned_cost,
          COUNT(DISTINCT scr.return_id)::int             AS return_count
        FROM store_customer_returns scr
        INNER JOIN sold s ON s.sales_id = scr.sales_id
        JOIN store_customer_return_items scri ON scri.return_id = scr.return_id
        JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
        WHERE scr.owner_id = ${owner_id}
          AND scr.created_at >= ${startFinal}
          AND scr.created_at <= ${endFinal}
        GROUP BY scr.sales_id
      ),
      per_sale AS (
        SELECT
          s.effective_total,
          s.paid_amount,
          s.discount,
          s.sold_cost,
          COALESCE(r.total_refund,   0) AS total_refund,
          COALESCE(r.returned_cost,  0) AS returned_cost,
          COALESCE(r.return_count,   0) AS return_count,
          -- net_paid: if refund covers outstanding due, excess offsets paid
          GREATEST(0,
            s.paid_amount - GREATEST(0,
              COALESCE(r.total_refund, 0) - GREATEST(0, s.effective_total - s.paid_amount)
            )
          ) AS net_paid,
          GREATEST(0,
            (s.effective_total - COALESCE(r.total_refund, 0)) -
            GREATEST(0,
              s.paid_amount - GREATEST(0,
                COALESCE(r.total_refund, 0) - GREATEST(0, s.effective_total - s.paid_amount)
              )
            )
          ) AS due
        FROM sold s
        LEFT JOIN returns r ON r.sales_id = s.sales_id
      )
      SELECT
        COUNT(*)::int                                                          AS sales_count,
        COALESCE(SUM(effective_total), 0)::numeric                            AS effective_total,
        COALESCE(SUM(discount), 0)::numeric                                   AS total_discount,
        COALESCE(SUM(effective_total - total_refund), 0)::numeric             AS actual_revenue,
        COALESCE(SUM(sold_cost - returned_cost), 0)::numeric                  AS net_cost,
        COALESCE(SUM(net_paid), 0)::numeric                                   AS total_paid,
        COALESCE(SUM(due), 0)::numeric                                        AS due_balance,
        COALESCE(SUM(return_count), 0)::int                                   AS return_count
      FROM per_sale;
    `;

    const row = rows[0] || {};
    const actualRevenue = Number(row.actual_revenue || 0);
    const netCost       = Number(row.net_cost       || 0);

    return {
      date_range: { start: startFinal.toISOString(), end: endFinal.toISOString() },
      summary: {
        sales_count:    Number(row.sales_count    || 0),
        total_sales:    Number(row.effective_total|| 0),
        total_discount: Number(row.total_discount || 0),
        actual_revenue: actualRevenue,
        total_cost:     netCost,
        total_paid:     Number(row.total_paid     || 0),
        due_balance:    Number(row.due_balance    || 0),
        return_count:   Number(row.return_count   || 0),
        estimated_profit: actualRevenue - netCost,
      },
    };
  }

  /**
   * Time-series: grouped sales/cost/profit chart
   */
  async salesChart(owner_id, { start, end, group }) {
    const g          = normalizeGroup(group);
    const startFinal = startOfDay(parseDateOrNull(start) ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const endFinal   = endOfDay(parseDateOrNull(end) ?? new Date());

    const rows = await prisma.$queryRaw`
      WITH sales_base AS (
        SELECT
          date_trunc(${g}, ss.created_at)                                        AS period,
          ss.sales_id,
          GREATEST(ss.total_amount - COALESCE(ss.discount, 0), 0)               AS effective_total,
          ss.paid_amount,
          ss.discount
        FROM store_sales ss
        WHERE ss.owner_id = ${owner_id}
          AND ss.created_at >= ${startFinal}
          AND ss.created_at <= ${endFinal}
      ),
      cost_by_period AS (
        SELECT
          date_trunc(${g}, ss.created_at)                                        AS period,
          COALESCE(SUM(COALESCE(ssi.cp, 0) * ssi.qty), 0)::numeric              AS sold_cost
        FROM store_sales_items ssi
        JOIN store_sales ss ON ss.sales_id = ssi.sales_id
        WHERE ss.owner_id = ${owner_id}
          AND ss.created_at >= ${startFinal}
          AND ss.created_at <= ${endFinal}
        GROUP BY 1
      ),
      returns_by_sale AS (
        SELECT
          scr.sales_id,
          COALESCE(SUM(scr.refund_amount), 0)           AS total_refund,
          COALESCE(SUM(COALESCE(ssi.cp,0) * scri.qty), 0) AS returned_cost
        FROM store_customer_returns scr
        JOIN store_customer_return_items scri ON scri.return_id = scr.return_id
        JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
        WHERE scr.owner_id = ${owner_id}
          AND scr.created_at >= ${startFinal}
          AND scr.created_at <= ${endFinal}
        GROUP BY scr.sales_id
      ),
      per_sale AS (
        SELECT
          sb.period,
          sb.effective_total,
          COALESCE(r.total_refund,  0) AS total_refund,
          COALESCE(r.returned_cost, 0) AS returned_cost,
          GREATEST(0,
            sb.paid_amount - GREATEST(0,
              COALESCE(r.total_refund,0) - GREATEST(0, sb.effective_total - sb.paid_amount)
            )
          ) AS net_paid,
          GREATEST(0,
            (sb.effective_total - COALESCE(r.total_refund,0)) -
            GREATEST(0,
              sb.paid_amount - GREATEST(0,
                COALESCE(r.total_refund,0) - GREATEST(0, sb.effective_total - sb.paid_amount)
              )
            )
          ) AS due
        FROM sales_base sb
        LEFT JOIN returns_by_sale r ON r.sales_id = sb.sales_id
      ),
      aggregated AS (
        SELECT
          period,
          SUM(effective_total)::numeric                   AS effective_total,
          SUM(total_refund)::numeric                      AS total_refund,
          SUM(returned_cost)::numeric                     AS returned_cost,
          SUM(net_paid)::numeric                          AS net_paid,
          SUM(due)::numeric                               AS due
        FROM per_sale
        GROUP BY period
      )
      SELECT
        a.period,
        a.effective_total,
        a.total_refund,
        (a.effective_total - a.total_refund)                   AS actual_revenue,
        COALESCE(c.sold_cost, 0)                               AS sold_cost,
        a.returned_cost,
        (COALESCE(c.sold_cost,0) - a.returned_cost)            AS net_cost,
        a.net_paid,
        a.due,
        (a.effective_total - a.total_refund)
          - (COALESCE(c.sold_cost,0) - a.returned_cost)        AS profit
      FROM aggregated a
      LEFT JOIN cost_by_period c ON c.period = a.period
      ORDER BY a.period ASC;
    `;

    return rows.map((r) => ({
      period:         new Date(r.period).toISOString(),
      effective_sales: Number(r.effective_total || 0),
      refund:         Number(r.total_refund    || 0),
      revenue:        Number(r.actual_revenue  || 0),
      cost:           Number(r.net_cost        || 0),
      paid:           Number(r.net_paid        || 0),
      due:            Number(r.due             || 0),
      profit:         Number(r.profit          || 0),
    }));
  }

  /**
   * Top selling products by net qty sold (items + services)
   */
  async topProducts(owner_id, { start, end, limit = 10 }) {
    const startFinal = startOfDay(parseDateOrNull(start) ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const endFinal   = endOfDay(parseDateOrNull(end) ?? new Date());
    const lim        = Math.min(Math.max(Number(limit || 10), 1), 50);

    const rows = await prisma.$queryRawUnsafe(
      `
      WITH sold AS (
        SELECT
          ssi.product_id,
          SUM(ssi.qty)::int              AS qty_sold,
          SUM(ssi.line_total)::numeric   AS revenue
        FROM store_sales_items ssi
        JOIN store_sales ss ON ss.sales_id = ssi.sales_id
        WHERE ss.owner_id = $1
          AND ss.created_at >= $2
          AND ss.created_at <= $3
        GROUP BY 1
      ),
      ret AS (
        SELECT
          ssi.product_id,
          SUM(scri.qty)::int                          AS qty_returned,
          SUM(ssi.sp * scri.qty)::numeric             AS return_value
        FROM store_customer_return_items scri
        JOIN store_customer_returns scr ON scr.return_id = scri.return_id
        JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
        WHERE scr.owner_id = $1
          AND scr.created_at >= $2
          AND scr.created_at <= $3
        GROUP BY 1
      )
      SELECT
        p.product_id,
        p.product_name,
        p.type,
        (COALESCE(s.qty_sold,0) - COALESCE(r.qty_returned,0))::int       AS net_qty,
        (COALESCE(s.revenue,0)  - COALESCE(r.return_value,0))::numeric   AS net_revenue,
        u.unit_name
      FROM store_products p
      LEFT JOIN sold s ON s.product_id = p.product_id
      LEFT JOIN ret  r ON r.product_id = p.product_id
      LEFT JOIN store_units u ON u.unit_id = p.unit_id
      WHERE p.owner_id = $1
        AND (COALESCE(s.qty_sold,0) - COALESCE(r.qty_returned,0)) > 0
      ORDER BY net_qty DESC
      LIMIT $4;
      `,
      owner_id, startFinal, endFinal, lim
    );

    return rows.map((x) => ({
      product_id:   x.product_id,
      product_name: x.product_name,
      type:         x.type,
      qty:          Number(x.net_qty      || 0),
      revenue:      Number(x.net_revenue  || 0),
      unit:         x.unit_name || null,
    }));
  }

  /**
   * Return analytics
   */
  async returnAnalytics(owner_id, { start, end }) {
    const startFinal = startOfDay(parseDateOrNull(start) ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const endFinal   = endOfDay(parseDateOrNull(end) ?? new Date());

    const summaryRows = await prisma.$queryRaw`
      SELECT
        COUNT(DISTINCT scr.return_id)::int                        AS total_returns,
        COALESCE(SUM(scri.qty), 0)::int                           AS total_qty,
        COALESCE(SUM(scr.refund_amount), 0)::numeric              AS total_refund,
        COALESCE(SUM(ssi.sp * scri.qty), 0)::numeric              AS return_value
      FROM store_customer_return_items scri
      JOIN store_customer_returns scr ON scr.return_id = scri.return_id
      JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
      WHERE scr.owner_id = ${owner_id}
        AND scr.created_at >= ${startFinal}
        AND scr.created_at <= ${endFinal};
    `;

    const productRows = await prisma.$queryRaw`
      SELECT
        p.product_id,
        p.product_name,
        COALESCE(SUM(scri.qty), 0)::int                           AS total_qty,
        COALESCE(SUM(ssi.sp * scri.qty), 0)::numeric              AS return_value,
        COUNT(DISTINCT scr.return_id)::int                        AS return_count,
        u.unit_name
      FROM store_customer_return_items scri
      JOIN store_customer_returns scr ON scr.return_id = scri.return_id
      JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
      JOIN store_products p ON p.product_id = ssi.product_id
      LEFT JOIN store_units u ON u.unit_id = p.unit_id
      WHERE scr.owner_id = ${owner_id}
        AND scr.created_at >= ${startFinal}
        AND scr.created_at <= ${endFinal}
      GROUP BY p.product_id, p.product_name, u.unit_name
      ORDER BY total_qty DESC
      LIMIT 10;
    `;

    const s = summaryRows[0] || {};
    const totalReturns = Number(s.total_returns || 0);
    const returnValue  = Number(s.return_value  || 0);

    return {
      date_range: { start: startFinal.toISOString(), end: endFinal.toISOString() },
      summary: {
        total_returns: totalReturns,
        total_qty:     Number(s.total_qty    || 0),
        total_refund:  Number(s.total_refund || 0),
        return_value:  returnValue,
        avg_return_value: totalReturns > 0 ? returnValue / totalReturns : 0,
      },
      top_products: productRows.map((x) => ({
        product_id:   x.product_id,
        product_name: x.product_name,
        total_qty:    Number(x.total_qty    || 0),
        return_value: Number(x.return_value || 0),
        return_count: Number(x.return_count || 0),
        unit:         x.unit_name || null,
      })),
    };
  }
}

export default new StoreProfitLossService();
