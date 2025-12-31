const { prisma } = require("../prisma/client");

function parseDateOrNull(x) {
  if (!x) return null;
  const d = new Date(String(x));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// group: day|week|month|year
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

    // Default range: last 30 days
    const startFinal = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endFinal = endDate || new Date();

    // We compute from SALES ITEMS to get sales+cost+profit
    // We compute PAID from ClothingSales table
    // We also subtract customer returns (refund logic) if you want accurate net sales.
    // Here: net_sales = sum(sales_items.line_total) - sum(return_qty * sales_item.sp)

    const rows = await prisma.$queryRaw`
      WITH sales_items AS (
        SELECT
          date_trunc(${g}, cs.created_at) AS period,
          SUM(csi.line_total)::numeric AS gross_sales,
          SUM((csi.cp * csi.qty))::numeric AS cost,
          SUM((csi.sp * csi.qty))::numeric AS sales_value
        FROM clothing_sales_items csi
        JOIN clothing_sales cs ON cs.sales_id = csi.sales_id
        WHERE cs.owner_id = ${owner_id}
          AND cs.created_at >= ${startFinal}
          AND cs.created_at <= ${endFinal}
        GROUP BY 1
      ),
      paid AS (
        SELECT
          date_trunc(${g}, created_at) AS period,
          SUM(paid_amount)::numeric AS paid_total
        FROM clothing_sales
        WHERE owner_id = ${owner_id}
          AND created_at >= ${startFinal}
          AND created_at <= ${endFinal}
        GROUP BY 1
      ),
      returns AS (
        SELECT
          date_trunc(${g}, ccr.created_at) AS period,
          SUM((csi.sp * ccri.qty))::numeric AS return_value
        FROM clothing_customer_return_items ccri
        JOIN clothing_customer_returns ccr ON ccr.return_id = ccri.return_id
        LEFT JOIN clothing_sales_items csi ON csi.sales_item_id = ccri.sales_item_id
        WHERE ccr.owner_id = ${owner_id}
          AND ccr.created_at >= ${startFinal}
          AND ccr.created_at <= ${endFinal}
        GROUP BY 1
      )
      SELECT
        COALESCE(si.period, p.period, r.period) AS period,
        COALESCE(si.gross_sales, 0) - COALESCE(r.return_value, 0) AS sales,
        COALESCE(si.cost, 0) AS cost,
        (COALESCE(si.gross_sales, 0) - COALESCE(r.return_value, 0)) - COALESCE(si.cost, 0) AS profit,
        COALESCE(p.paid_total, 0) AS paid
      FROM sales_items si
      FULL OUTER JOIN paid p ON p.period = si.period
      FULL OUTER JOIN returns r ON r.period = COALESCE(si.period, p.period)
      ORDER BY period ASC;
    `;

    // Convert period to ISO date string (frontend friendly)
    return rows.map(r => {
      const sales = Number(r.sales || 0);
      const cost = Number(r.cost || 0);
      const paid = Number(r.paid || 0);
      return {
        period: new Date(r.period).toISOString(),
        sales,
        cost,
        paid,
        profit: Number(r.profit || 0),
        balance: sales - paid,
      };
    });
  }

  async topProducts(owner_id, { start, end, limit = 3 }) {
    const startDate = parseDateOrNull(start);
    const endDate = parseDateOrNull(end);

    const startFinal =
        startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endFinal = endDate || new Date();

    const lim = Math.min(Math.max(Number(limit || 3), 1), 20);

    // ✅ Net QTY = sold qty - returned qty
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
        lim
    );

    return rows.map((x) => ({
        product_id: x.product_id,
        product_name: x.product_name,
        qty: Number(x.net_qty || 0),
    }));
    }


  // ✅ qty in / qty out / profit grouped by date
  async stockFlow(owner_id, { start, end, group }) {
    const g = normalizeGroup(group);
    const startDate = parseDateOrNull(start);
    const endDate = parseDateOrNull(end);
    const startFinal = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endFinal = endDate || new Date();

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
          SUM(csi.line_total)::numeric AS sales,
          SUM((csi.cp * csi.qty))::numeric AS cost
        FROM clothing_sales_items csi
        JOIN clothing_sales cs ON cs.sales_id = csi.sales_id
        WHERE cs.owner_id = ${owner_id}
          AND cs.created_at >= ${startFinal}
          AND cs.created_at <= ${endFinal}
        GROUP BY 1
      ),
      returns AS (
        SELECT
          date_trunc(${g}, ccr.created_at) AS period,
          SUM(ccri.qty)::int AS qty_returned,
          SUM((csi.sp * ccri.qty))::numeric AS return_value
        FROM clothing_customer_return_items ccri
        JOIN clothing_customer_returns ccr ON ccr.return_id = ccri.return_id
        LEFT JOIN clothing_sales_items csi ON csi.sales_item_id = ccri.sales_item_id
        WHERE ccr.owner_id = ${owner_id}
          AND ccr.created_at >= ${startFinal}
          AND ccr.created_at <= ${endFinal}
        GROUP BY 1
      )
      SELECT
        COALESCE(i.period, o.period, r.period) AS period,
        COALESCE(i.qty_in, 0) AS qty_in,
        (COALESCE(o.qty_out, 0) - COALESCE(r.qty_returned, 0)) AS net_qty_out,
        (COALESCE(o.sales, 0) - COALESCE(r.return_value, 0)) AS net_sales,
        COALESCE(o.cost, 0) AS cost,
        (COALESCE(o.sales, 0) - COALESCE(r.return_value, 0)) - COALESCE(o.cost, 0) AS profit
      FROM qty_in i
      FULL OUTER JOIN qty_out o ON o.period = i.period
      FULL OUTER JOIN returns r ON r.period = COALESCE(i.period, o.period)
      ORDER BY period ASC;
    `;

    return rows.map(r => ({
      period: new Date(r.period).toISOString(),
      qty_in: Number(r.qty_in || 0),
      qty_out: Number(r.net_qty_out || 0),
      sales: Number(r.net_sales || 0),
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
      ...rows.map(r => headers.map(h => escape(r[h])).join(",")),
    ];
    return lines.join("\n") + "\n";
  }
}

module.exports = new ClothingReportService();
