import { prisma } from "../prisma/client.js";

function parseDateOrNull(x) {
  if (!x) return null;
  const d = new Date(String(x));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function normalizeGroup(group) {
  const g = String(group || "day").toLowerCase();
  if (!["day", "week", "month", "year"].includes(g)) return "day";
  return g;
}

class ClothingReportService {
  // ✅ Chart: Sales vs Cost vs Paid (grouped by date)
  async salesCostPaid(owner_id, { start, end, group }) {
    const g = normalizeGroup(group);
    const startDate = parseDateOrNull(start);
    const endDate = parseDateOrNull(end);

    const startFinal = startDate
      ? startOfDay(startDate)
      : startOfDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    const endFinal = endDate ? endOfDay(endDate) : endOfDay(new Date());

    const rows = await prisma.$queryRaw`
      WITH sales_with_effective AS (
        -- one row per sale with effective total and paid amount
        SELECT
          date_trunc(${g}, cs.created_at) AS period,
          cs.sales_id,
          GREATEST(cs.total_amount - COALESCE(cs.discount, 0), 0) AS effective_total,
          cs.paid_amount
        FROM clothing_sales cs
        WHERE cs.owner_id = ${owner_id}
          AND cs.created_at >= ${startFinal}
          AND cs.created_at <= ${endFinal}
      ),
      returns_per_sale AS (
        -- sum refund and returned cost per sale (not per day)
        SELECT
          ccr.sales_id,
          COALESCE(SUM(ccr.refund_amount), 0)::numeric AS refund_total,
          COALESCE(SUM(csi.cp * ccri.qty), 0)::numeric AS returned_cost
        FROM clothing_customer_returns ccr
        LEFT JOIN clothing_customer_return_items ccri ON ccri.return_id = ccr.return_id
        LEFT JOIN clothing_sales_items csi ON csi.sales_item_id = ccri.sales_item_id
        WHERE ccr.owner_id = ${owner_id}
          AND ccr.created_at >= ${startFinal}
          AND ccr.created_at <= ${endFinal}
        GROUP BY ccr.sales_id
      ),
      per_sale AS (
        -- calculate netPaid and due per sale first
        SELECT
          s.period,
          s.sales_id,
          s.effective_total,
          s.paid_amount,
          COALESCE(r.refund_total, 0) AS refund_total,
          COALESCE(r.returned_cost, 0) AS returned_cost,
          -- net_paid per sale:
          -- if refund > due, excess reduces paid shown
          -- due_before_refund = effective_total - paid_amount
          -- excess_refund = refund - due_before_refund
          -- net_paid = paid_amount - excess_refund
          GREATEST(0,
            s.paid_amount - GREATEST(0,
              COALESCE(r.refund_total, 0) - GREATEST(0, s.effective_total - s.paid_amount)
            )
          )::numeric AS net_paid,
          -- due per sale = revenue - net_paid
          GREATEST(0,
            (s.effective_total - COALESCE(r.refund_total, 0)) -
            GREATEST(0,
              s.paid_amount - GREATEST(0,
                COALESCE(r.refund_total, 0) - GREATEST(0, s.effective_total - s.paid_amount)
              )
            )
          )::numeric AS due
        FROM sales_with_effective s
        LEFT JOIN returns_per_sale r ON r.sales_id = s.sales_id
      ),
      cost_grouped AS (
        -- total cost per period
        SELECT
          date_trunc(${g}, cs.created_at) AS period,
          SUM(csi.cp * csi.qty)::numeric AS cost
        FROM clothing_sales_items csi
        JOIN clothing_sales cs ON cs.sales_id = csi.sales_id
        WHERE cs.owner_id = ${owner_id}
          AND cs.created_at >= ${startFinal}
          AND cs.created_at <= ${endFinal}
        GROUP BY 1
      )
      -- now sum per_sale values per period
      SELECT
        ps.period,
        SUM(ps.effective_total)::numeric AS effective_sales,
        SUM(ps.refund_total)::numeric AS refund_total,
        SUM(ps.returned_cost)::numeric AS returned_cost,
        SUM(ps.net_paid)::numeric AS net_paid,
        SUM(ps.due)::numeric AS due,
        COALESCE(MAX(cg.cost), 0)::numeric AS cost
      FROM per_sale ps
      LEFT JOIN cost_grouped cg ON cg.period = ps.period
      GROUP BY ps.period
      ORDER BY ps.period ASC;
    `;

    return rows.map((r) => {
      const effectiveSales = Number(r.effective_sales || 0);
      const refund = Number(r.refund_total || 0);
      const returnedCost = Number(r.returned_cost || 0);
      const revenue = effectiveSales - refund;
      const cost = Number(r.cost || 0) - returnedCost;

      // ✅ netPaid and due calculated per sale in SQL, just use them here
      const netPaid = Number(r.net_paid || 0);
      const due = Number(r.due || 0);

      const profit = revenue - cost;

      return {
        period: new Date(r.period).toISOString(),
        sales: revenue,
        effective_sales: effectiveSales,
        refund,
        cost,
        paid: netPaid,
        profit,
        balance: due,
      };
    });
  }

  async topProducts(owner_id, { start, end, limit = 3 }) {
    const startDate = parseDateOrNull(start);
    const endDate = parseDateOrNull(end);

    const startFinal = startDate
      ? startOfDay(startDate)
      : startOfDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    const endFinal = endDate ? endOfDay(endDate) : endOfDay(new Date());

    const lim = Math.min(Math.max(Number(limit || 3), 1), 20);

    const rows = await prisma.$queryRawUnsafe(
      `
        WITH sold AS (
        SELECT
            csi.product_id,
            SUM(csi.qty)::int AS qty_sold
        FROM clothing_sales_items csi
        JOIN clothing_sales cs ON cs.sales_id = csi.sales_id
        WHERE cs.owner_id = $1
            AND cs.created_at >= $2
            AND cs.created_at <= $3
        GROUP BY 1
        ),
        ret AS (
        SELECT
            csi.product_id,
            SUM(ccri.qty)::int AS qty_returned
        FROM clothing_customer_return_items ccri
        JOIN clothing_customer_returns ccr ON ccr.return_id = ccri.return_id
        JOIN clothing_sales_items csi ON csi.sales_item_id = ccri.sales_item_id
        WHERE ccr.owner_id = $1
            AND ccr.created_at >= $2
            AND ccr.created_at <= $3
        GROUP BY 1
        )
        SELECT
        p.product_id,
        p.product_name,
        (COALESCE(s.qty_sold,0) - COALESCE(r.qty_returned,0))::int AS net_qty
        FROM clothing_products p
        LEFT JOIN sold s ON s.product_id = p.product_id
        LEFT JOIN ret r ON r.product_id = p.product_id
        WHERE p.owner_id = $1
        ORDER BY net_qty DESC
        LIMIT $4;
        `,
      owner_id,
      startFinal,
      endFinal,
      lim,
    );

    return rows.map((x) => ({
      product_id: x.product_id,
      product_name: x.product_name,
      qty: Number(x.net_qty || 0),
    }));
  }

  async stockFlow(owner_id, { start, end, group }) {
    const g = normalizeGroup(group);
    const startDate = parseDateOrNull(start);
    const endDate = parseDateOrNull(end);

    const startFinal = startDate
      ? startOfDay(startDate)
      : startOfDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    const endFinal = endDate ? endOfDay(endDate) : endOfDay(new Date());

    const rows = await prisma.$queryRaw`
      WITH qty_in AS (
        SELECT
          date_trunc(${g}, csl.created_at) AS period,
          SUM(csl.qty_in)::int AS qty_in
        FROM clothing_stock_lots csl
        JOIN clothing_products p ON p.product_id = csl.product_id
        WHERE p.owner_id = ${owner_id}
          AND csl.created_at >= ${startFinal}
          AND csl.created_at <= ${endFinal}
        GROUP BY 1
      ),
      qty_out AS (
        SELECT
          date_trunc(${g}, cs.created_at) AS period,
          SUM(csi.qty)::int AS qty_out,
          SUM(csi.cp * csi.qty)::numeric AS cost
        FROM clothing_sales_items csi
        JOIN clothing_sales cs ON cs.sales_id = csi.sales_id
        WHERE cs.owner_id = ${owner_id}
          AND cs.created_at >= ${startFinal}
          AND cs.created_at <= ${endFinal}
        GROUP BY 1
      ),
      effective_sales AS (
        SELECT
          date_trunc(${g}, created_at) AS period,
          SUM(GREATEST(total_amount - COALESCE(discount, 0), 0))::numeric AS effective_sales
        FROM clothing_sales
        WHERE owner_id = ${owner_id}
          AND created_at >= ${startFinal}
          AND created_at <= ${endFinal}
        GROUP BY 1
      ),
      returns AS (
        SELECT
          date_trunc(${g}, ccr.created_at) AS period,
          SUM(ccri.qty)::int AS qty_returned,
          COALESCE(SUM(ccr.refund_amount), 0)::numeric AS refund_total,
          COALESCE(SUM(CASE WHEN LOWER(ccri.condition) = 'good' THEN csi.cp * ccri.qty ELSE 0 END), 0)::numeric AS returned_cost_good
        FROM clothing_customer_returns ccr
        LEFT JOIN clothing_customer_return_items ccri ON ccri.return_id = ccr.return_id
        LEFT JOIN clothing_sales_items csi ON csi.sales_item_id = ccri.sales_item_id
        WHERE ccr.owner_id = ${owner_id}
          AND ccr.created_at >= ${startFinal}
          AND ccr.created_at <= ${endFinal}
        GROUP BY 1
      )
      SELECT
        COALESCE(i.period, o.period, e.period, r.period) AS period,
        COALESCE(i.qty_in, 0) AS qty_in,
        (COALESCE(o.qty_out, 0) - COALESCE(r.qty_returned, 0)) AS net_qty_out,
        (COALESCE(e.effective_sales, 0) - COALESCE(r.refund_total, 0)) AS actual_revenue,
        COALESCE(r.refund_total, 0) AS refund_total,
        (COALESCE(o.cost, 0) - COALESCE(r.returned_cost_good, 0)) AS cost,
        (COALESCE(e.effective_sales, 0) - COALESCE(r.refund_total, 0))
          - (COALESCE(o.cost, 0) - COALESCE(r.returned_cost_good, 0)) AS profit
      FROM qty_in i
      FULL OUTER JOIN qty_out o ON o.period = i.period
      FULL OUTER JOIN effective_sales e ON e.period = COALESCE(i.period, o.period)
      FULL OUTER JOIN returns r ON r.period = COALESCE(i.period, o.period, e.period)
      WHERE (COALESCE(o.qty_out, 0) > 0 OR COALESCE(r.qty_returned, 0) > 0)
      ORDER BY period ASC;
    `;

    return rows.map((r) => ({
      period: new Date(r.period).toISOString(),
      qty_in: Number(r.qty_in || 0),
      qty_out: Number(r.net_qty_out || 0),
      sales: Number(r.actual_revenue || 0),
      refund: Number(r.refund_total || 0),
      cost: Number(r.cost || 0),
      profit: Number(r.profit || 0),
    }));
  }

  // ✅ simple CSV converter
  toCSV(rows) {
    if (!rows || rows.length === 0) return "No data\n";
    const headers = Object.keys(rows[0]);
    const escape = (v) => {
      const s = String(v ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const lines = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
    ];
    return lines.join("\n") + "\n";
  }

  async returnAnalytics(owner_id, { start, end }) {
    const startDate = parseDateOrNull(start);
    const endDate = parseDateOrNull(end);

    const startFinal = startDate
      ? startOfDay(startDate)
      : startOfDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    const endFinal = endDate ? endOfDay(endDate) : endOfDay(new Date());

    const summaryRows = await prisma.$queryRaw`
      SELECT
        COUNT(DISTINCT ccr.return_id)::int AS total_returns,
        COALESCE(SUM(ccri.qty), 0)::int AS total_qty,
        COALESCE(SUM(csi.sp * ccri.qty), 0)::numeric AS return_value
      FROM clothing_customer_return_items ccri
      JOIN clothing_customer_returns ccr
        ON ccr.return_id = ccri.return_id
      LEFT JOIN clothing_sales_items csi
        ON csi.sales_item_id = ccri.sales_item_id
      WHERE ccr.owner_id = ${owner_id}
        AND ccr.created_at >= ${startFinal}
        AND ccr.created_at <= ${endFinal};
    `;

    const productRows = await prisma.$queryRaw`
      SELECT
        p.product_id,
        p.product_name,
        COALESCE(SUM(ccri.qty), 0)::int AS total_qty,
        COALESCE(SUM(csi.sp * ccri.qty), 0)::numeric AS return_value
      FROM clothing_customer_return_items ccri
      JOIN clothing_customer_returns ccr
        ON ccr.return_id = ccri.return_id
      LEFT JOIN clothing_sales_items csi
        ON csi.sales_item_id = ccri.sales_item_id
      LEFT JOIN clothing_products p
        ON p.product_id = csi.product_id
      WHERE ccr.owner_id = ${owner_id}
        AND ccr.created_at >= ${startFinal}
        AND ccr.created_at <= ${endFinal}
      GROUP BY p.product_id, p.product_name
      ORDER BY total_qty DESC
      LIMIT 10;
    `;

    const s = summaryRows[0] || {};

    return {
      summary: {
        total_returns: Number(s.total_returns || 0),
        total_qty: Number(s.total_qty || 0),
        return_value: Number(s.return_value || 0),
      },
      top_products: productRows.map((x) => ({
        product_id: x.product_id,
        product_name: x.product_name || "Unknown Product",
        total_qty: Number(x.total_qty || 0),
        return_value: Number(x.return_value || 0),
      })),
    };
  }
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

export default new ClothingReportService();
// import { prisma } from "../prisma/client.js";

// function parseDateOrNull(x) {
//   if (!x) return null;
//   const d = new Date(String(x));
//   if (Number.isNaN(d.getTime())) return null;
//   return d;
// }

// function normalizeGroup(group) {
//   const g = String(group || "day").toLowerCase();
//   if (!["day", "week", "month", "year"].includes(g)) return "day";
//   return g;
// }

// class ClothingReportService {
//   // ✅ Chart: Sales vs Cost vs Paid (grouped by date)
//   async salesCostPaid(owner_id, { start, end, group }) {
//     const g = normalizeGroup(group);
//     const startDate = parseDateOrNull(start);
//     const endDate = parseDateOrNull(end);

//     const startFinal = startDate
//       ? startOfDay(startDate)
//       : startOfDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

//     const endFinal = endDate ? endOfDay(endDate) : endOfDay(new Date());

//     const rows = await prisma.$queryRaw`
//       WITH sales_with_effective AS (
//         SELECT
//           date_trunc(${g}, cs.created_at) AS period,
//           cs.sales_id,
//           GREATEST(cs.total_amount - COALESCE(cs.discount, 0), 0) AS effective_total
//         FROM clothing_sales cs
//         WHERE cs.owner_id = ${owner_id}
//           AND cs.created_at >= ${startFinal}
//           AND cs.created_at <= ${endFinal}
//       ),
//       sales_grouped AS (
//         SELECT
//           period,
//           SUM(effective_total)::numeric AS total_effective_sales
//         FROM sales_with_effective
//         GROUP BY period
//       ),
//       cost_grouped AS (
//         SELECT
//           date_trunc(${g}, cs.created_at) AS period,
//           SUM((csi.cp * csi.qty))::numeric AS cost
//         FROM clothing_sales_items csi
//         JOIN clothing_sales cs ON cs.sales_id = csi.sales_id
//         WHERE cs.owner_id = ${owner_id}
//           AND cs.created_at >= ${startFinal}
//           AND cs.created_at <= ${endFinal}
//         GROUP BY 1
//       ),
//       paid AS (
//         SELECT
//           date_trunc(${g}, created_at) AS period,
//           SUM(paid_amount)::numeric AS paid_total
//         FROM clothing_sales
//         WHERE owner_id = ${owner_id}
//           AND created_at >= ${startFinal}
//           AND created_at <= ${endFinal}
//         GROUP BY 1
//       ),
//       returns AS (
//         SELECT
//           date_trunc(${g}, ccr.created_at) AS period,
//           SUM(COALESCE(ccr.refund_amount, 0))::numeric AS refund_total,
//           COALESCE(SUM(csi.cp * ccri.qty), 0)::numeric AS returned_cost
//         FROM clothing_customer_returns ccr
//         LEFT JOIN clothing_customer_return_items ccri ON ccri.return_id = ccr.return_id
//         LEFT JOIN clothing_sales_items csi ON csi.sales_item_id = ccri.sales_item_id
//         WHERE ccr.owner_id = ${owner_id}
//           AND ccr.created_at >= ${startFinal}
//           AND ccr.created_at <= ${endFinal}
//         GROUP BY 1
//       )

//       SELECT
//         COALESCE(sg.period, cg.period, p.period, r.period) AS period,
//         COALESCE(sg.total_effective_sales, 0) AS effective_sales,
//         COALESCE(cg.cost, 0) AS cost,
//         COALESCE(p.paid_total, 0) AS paid,
//         COALESCE(r.refund_total, 0) AS refund_total,
//         COALESCE(r.returned_cost, 0) AS returned_cost
//       FROM sales_grouped sg
//       FULL OUTER JOIN cost_grouped cg ON cg.period = sg.period
//       FULL OUTER JOIN paid p ON p.period = COALESCE(sg.period, cg.period)
//       FULL OUTER JOIN returns r ON r.period = COALESCE(sg.period, cg.period, p.period)
//       ORDER BY period ASC;
//     `;

//     return rows.map((r) => {
//       const effectiveSales = Number(r.effective_sales || 0);
//       const refund = Number(r.refund_total || 0);
//       const returnedCost = Number(r.returned_cost || 0);
//       const revenue = effectiveSales - refund;
//       // cost is reduced by returned cp*qty since those items came back
//       // profit lost on return = refund - cp*qty
//       const cost = Number(r.cost || 0) - returnedCost;
//       const paidRaw = Number(r.paid || 0);
      
//       // Calculate net paid: if refund exceeds due, reduce paid by excess
//       // Example: revenue=5000, paid=3000, refund=2500
//       // due_before_refund = 5000-3000 = 2000
//       // excess_refund = 2500-2000 = 500
//       // net_paid = 3000-500 = 2500
//       const dueBeforeRefund = Math.max(0, effectiveSales - paidRaw);
//       const excessRefund = Math.max(0, refund - dueBeforeRefund);
//       const netPaid = Math.max(0, paidRaw - excessRefund);
      
//       const profit = revenue - cost;
//       const due = Math.max(0, revenue - netPaid);

      
//       return {
//         period: new Date(r.period).toISOString(),
//         sales: revenue,
//         effective_sales: effectiveSales,
//         refund,
//         cost,
//         paid: netPaid, // ✅ Now returns net paid after refund adjustments
//         profit,
//         balance: due > 0 ? due : 0,
//       };
//     });
//   }

//   async topProducts(owner_id, { start, end, limit = 3 }) {
//     const startDate = parseDateOrNull(start);
//     const endDate = parseDateOrNull(end);

//     const startFinal = startDate
//       ? startOfDay(startDate)
//       : startOfDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

//     const endFinal = endDate ? endOfDay(endDate) : endOfDay(new Date());

//     const lim = Math.min(Math.max(Number(limit || 3), 1), 20);

//     const rows = await prisma.$queryRawUnsafe(
//       `
//         WITH sold AS (
//         SELECT
//             csi.product_id,
//             SUM(csi.qty)::int AS qty_sold
//         FROM clothing_sales_items csi
//         JOIN clothing_sales cs ON cs.sales_id = csi.sales_id
//         WHERE cs.owner_id = $1
//             AND cs.created_at >= $2
//             AND cs.created_at <= $3
//         GROUP BY 1
//         ),
//         ret AS (
//         SELECT
//             csi.product_id,
//             SUM(ccri.qty)::int AS qty_returned
//         FROM clothing_customer_return_items ccri
//         JOIN clothing_customer_returns ccr ON ccr.return_id = ccri.return_id
//         JOIN clothing_sales_items csi ON csi.sales_item_id = ccri.sales_item_id
//         WHERE ccr.owner_id = $1
//             AND ccr.created_at >= $2
//             AND ccr.created_at <= $3
//         GROUP BY 1
//         )
//         SELECT
//         p.product_id,
//         p.product_name,
//         (COALESCE(s.qty_sold,0) - COALESCE(r.qty_returned,0))::int AS net_qty
//         FROM clothing_products p
//         LEFT JOIN sold s ON s.product_id = p.product_id
//         LEFT JOIN ret r ON r.product_id = p.product_id
//         WHERE p.owner_id = $1
//         ORDER BY net_qty DESC
//         LIMIT $4;
//         `,
//       owner_id,
//       startFinal,
//       endFinal,
//       lim,
//     );

//     return rows.map((x) => ({
//       product_id: x.product_id,
//       product_name: x.product_name,
//       qty: Number(x.net_qty || 0),
//     }));
//   }

//   async stockFlow(owner_id, { start, end, group }) {
//     const g = normalizeGroup(group);
//     const startDate = parseDateOrNull(start);
//     const endDate = parseDateOrNull(end);

//     const startFinal = startDate
//       ? startOfDay(startDate)
//       : startOfDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

//     const endFinal = endDate ? endOfDay(endDate) : endOfDay(new Date());

//     const rows = await prisma.$queryRaw`
//       WITH qty_in AS (
//         SELECT
//           date_trunc(${g}, csl.created_at) AS period,
//           SUM(csl.qty_in)::int AS qty_in
//         FROM clothing_stock_lots csl
//         JOIN clothing_products p ON p.product_id = csl.product_id
//         WHERE p.owner_id = ${owner_id}
//           AND csl.created_at >= ${startFinal}
//           AND csl.created_at <= ${endFinal}
//         GROUP BY 1
//       ),
//       qty_out AS (
//         SELECT
//           date_trunc(${g}, cs.created_at) AS period,
//           SUM(csi.qty)::int AS qty_out,
//           SUM(csi.cp * csi.qty)::numeric AS cost
//         FROM clothing_sales_items csi
//         JOIN clothing_sales cs ON cs.sales_id = csi.sales_id
//         WHERE cs.owner_id = ${owner_id}
//           AND cs.created_at >= ${startFinal}
//           AND cs.created_at <= ${endFinal}
//         GROUP BY 1
//       ),
//       effective_sales AS (
//         SELECT
//           date_trunc(${g}, created_at) AS period,
//           SUM(GREATEST(total_amount - COALESCE(discount, 0), 0))::numeric AS effective_sales
//         FROM clothing_sales
//         WHERE owner_id = ${owner_id}
//           AND created_at >= ${startFinal}
//           AND created_at <= ${endFinal}
//         GROUP BY 1
//       ),
//       returns AS (
//         SELECT
//           date_trunc(${g}, ccr.created_at) AS period,
//           SUM(ccri.qty)::int AS qty_returned,
//           COALESCE(SUM(ccr.refund_amount), 0)::numeric AS refund_total,
//           -- only GOOD returns recover CP (item goes back to stock) — matches summary logic
//           COALESCE(SUM(CASE WHEN LOWER(ccri.condition) = 'good' THEN csi.cp * ccri.qty ELSE 0 END), 0)::numeric AS returned_cost_good
//         FROM clothing_customer_returns ccr
//         LEFT JOIN clothing_customer_return_items ccri ON ccri.return_id = ccr.return_id
//         LEFT JOIN clothing_sales_items csi ON csi.sales_item_id = ccri.sales_item_id
//         WHERE ccr.owner_id = ${owner_id}
//           AND ccr.created_at >= ${startFinal}
//           AND ccr.created_at <= ${endFinal}
//         GROUP BY 1
//       )
//       SELECT
//         COALESCE(i.period, o.period, e.period, r.period) AS period,
//         COALESCE(i.qty_in, 0) AS qty_in,
//         (COALESCE(o.qty_out, 0) - COALESCE(r.qty_returned, 0)) AS net_qty_out,
//         -- actual_revenue = effective_sales - refund  (matches summary)
//         (COALESCE(e.effective_sales, 0) - COALESCE(r.refund_total, 0)) AS actual_revenue,
//         COALESCE(r.refund_total, 0) AS refund_total,
//         -- net_cost = sold_cost - returned_cost_good  (matches summary)
//         (COALESCE(o.cost, 0) - COALESCE(r.returned_cost_good, 0)) AS cost,
//         -- profit = actual_revenue - net_cost  (matches summary)
//         (COALESCE(e.effective_sales, 0) - COALESCE(r.refund_total, 0))
//           - (COALESCE(o.cost, 0) - COALESCE(r.returned_cost_good, 0)) AS profit
//       FROM qty_in i
//       FULL OUTER JOIN qty_out o ON o.period = i.period
//       FULL OUTER JOIN effective_sales e ON e.period = COALESCE(i.period, o.period)
//       FULL OUTER JOIN returns r ON r.period = COALESCE(i.period, o.period, e.period)
//       WHERE (COALESCE(o.qty_out, 0) > 0 OR COALESCE(r.qty_returned, 0) > 0)
//       ORDER BY period ASC;
//     `;

//     return rows.map((r) => ({
//       period: new Date(r.period).toISOString(),
//       qty_in: Number(r.qty_in || 0),
//       qty_out: Number(r.net_qty_out || 0),
//       sales: Number(r.actual_revenue || 0),
//       refund: Number(r.refund_total || 0),
//       cost: Number(r.cost || 0),
//       profit: Number(r.profit || 0),
//     }));
//   }

//   // ✅ simple CSV converter
//   toCSV(rows) {
//     if (!rows || rows.length === 0) return "No data\n";
//     const headers = Object.keys(rows[0]);
//     const escape = (v) => {
//       const s = String(v ?? "");
//       if (s.includes(",") || s.includes('"') || s.includes("\n")) {
//         return `"${s.replace(/"/g, '""')}"`;
//       }
//       return s;
//     };
//     const lines = [
//       headers.join(","),
//       ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
//     ];
//     return lines.join("\n") + "\n";
//   }

//   async returnAnalytics(owner_id, { start, end }) {
//     const startDate = parseDateOrNull(start);
//     const endDate = parseDateOrNull(end);

//     const startFinal = startDate
//       ? startOfDay(startDate)
//       : startOfDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

//     const endFinal = endDate ? endOfDay(endDate) : endOfDay(new Date());

//     const summaryRows = await prisma.$queryRaw`
//       SELECT
//         COUNT(DISTINCT ccr.return_id)::int AS total_returns,
//         COALESCE(SUM(ccri.qty), 0)::int AS total_qty,
//         COALESCE(SUM(csi.sp * ccri.qty), 0)::numeric AS return_value
//       FROM clothing_customer_return_items ccri
//       JOIN clothing_customer_returns ccr
//         ON ccr.return_id = ccri.return_id
//       LEFT JOIN clothing_sales_items csi
//         ON csi.sales_item_id = ccri.sales_item_id
//       WHERE ccr.owner_id = ${owner_id}
//         AND ccr.created_at >= ${startFinal}
//         AND ccr.created_at <= ${endFinal};
//     `;

//     const productRows = await prisma.$queryRaw`
//       SELECT
//         p.product_id,
//         p.product_name,
//         COALESCE(SUM(ccri.qty), 0)::int AS total_qty,
//         COALESCE(SUM(csi.sp * ccri.qty), 0)::numeric AS return_value
//       FROM clothing_customer_return_items ccri
//       JOIN clothing_customer_returns ccr
//         ON ccr.return_id = ccri.return_id
//       LEFT JOIN clothing_sales_items csi
//         ON csi.sales_item_id = ccri.sales_item_id
//       LEFT JOIN clothing_products p
//         ON p.product_id = csi.product_id
//       WHERE ccr.owner_id = ${owner_id}
//         AND ccr.created_at >= ${startFinal}
//         AND ccr.created_at <= ${endFinal}
//       GROUP BY p.product_id, p.product_name
//       ORDER BY total_qty DESC
//       LIMIT 10;
//     `;

//     const s = summaryRows[0] || {};

//     return {
//       summary: {
//         total_returns: Number(s.total_returns || 0),
//         total_qty: Number(s.total_qty || 0),
//         return_value: Number(s.return_value || 0),
//       },
//       top_products: productRows.map((x) => ({
//         product_id: x.product_id,
//         product_name: x.product_name || "Unknown Product",
//         total_qty: Number(x.total_qty || 0),
//         return_value: Number(x.return_value || 0),
//       })),
//     };
//   }
// }

// function startOfDay(d) {
//   const x = new Date(d);
//   x.setHours(0, 0, 0, 0);
//   return x;
// }

// function endOfDay(d) {
//   const x = new Date(d);
//   x.setHours(23, 59, 59, 999);
//   return x;
// }

// export default new ClothingReportService();