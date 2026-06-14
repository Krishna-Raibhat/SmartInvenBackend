// src/services/storeDashboardService.js
import { prisma } from "../prisma/client.js";

const NPT_OFFSET_MS = 5 * 60 * 60 * 1000 + 45 * 60 * 1000; // UTC+5:45

function nowNPT() {
  const nowUTC = new Date();
  return new Date(nowUTC.getTime() + NPT_OFFSET_MS);
}

function todayStartUTC() {
  const npt = nowNPT();
  return new Date(
    Date.UTC(npt.getUTCFullYear(), npt.getUTCMonth(), npt.getUTCDate(), 0, 0, 0, 0) - NPT_OFFSET_MS
  );
}

function monthStartUTC() {
  const npt = nowNPT();
  return new Date(
    Date.UTC(npt.getUTCFullYear(), npt.getUTCMonth(), 1, 0, 0, 0, 0) - NPT_OFFSET_MS
  );
}

function daysAgoStartUTC(days) {
  const npt = nowNPT();
  const d = new Date(npt.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0) - NPT_OFFSET_MS
  );
}

class StoreDashboardService {
  async getDashboard(owner_id) {
    const nowUTC = new Date();
    const todayStart  = todayStartUTC();
    const monthStart  = monthStartUTC();
    const last7Start  = daysAgoStartUTC(7);

    const [today, thisMonth, allTime, salesChart, recentActivities, lowStockItems] =
      await Promise.all([
        this._getStats(owner_id, todayStart, nowUTC),
        this._getStats(owner_id, monthStart, nowUTC),
        this._getStats(owner_id, null, null),
        this._getSalesChart(owner_id, last7Start, nowUTC),
        this._getRecentActivities(owner_id, 6),
        this._getLowStockItems(owner_id, 40,5),
      ]);

    return {
      today,
      this_month: thisMonth,
      all_time: allTime,
      sales_chart: salesChart,
      recent_activities: recentActivities,
      low_stock_items: lowStockItems,
    };
  }

  async _getStats(owner_id, startDate, endDate) {
    const hasDate = startDate && endDate;

    // Sales totals
    const salesRows = hasDate
      ? await prisma.$queryRaw`
          SELECT
            COALESCE(SUM(total_amount), 0)::numeric           AS total_amount,
            COALESCE(SUM(discount), 0)::numeric               AS total_discount,
            COALESCE(SUM(paid_amount), 0)::numeric            AS total_paid,
            COALESCE(SUM(due_amount), 0)::numeric             AS total_due,
            COALESCE(SUM(GREATEST(total_amount - COALESCE(discount,0),0)),0)::numeric AS effective_total,
            COUNT(sales_id)::int                              AS sales_count
          FROM store_sales
          WHERE owner_id = ${owner_id}
            AND created_at >= ${startDate}
            AND created_at <= ${endDate}
        `
      : await prisma.$queryRaw`
          SELECT
            COALESCE(SUM(total_amount), 0)::numeric           AS total_amount,
            COALESCE(SUM(discount), 0)::numeric               AS total_discount,
            COALESCE(SUM(paid_amount), 0)::numeric            AS total_paid,
            COALESCE(SUM(due_amount), 0)::numeric             AS total_due,
            COALESCE(SUM(GREATEST(total_amount - COALESCE(discount,0),0)),0)::numeric AS effective_total,
            COUNT(sales_id)::int                              AS sales_count
          FROM store_sales
          WHERE owner_id = ${owner_id}
        `;

    const sr = salesRows[0] || {};

    // Profit calculation (revenue - cost)
    const profitRows = hasDate
      ? await prisma.$queryRaw`
          WITH sold AS (
            SELECT
              ss.sales_id,
              GREATEST(ss.total_amount - COALESCE(ss.discount, 0), 0) AS effective_total,
              COALESCE(SUM(COALESCE(ssi.cp, 0) * ssi.qty), 0)         AS sold_cost
            FROM store_sales_items ssi
            JOIN store_sales ss ON ss.sales_id = ssi.sales_id
            WHERE ss.owner_id = ${owner_id}
              AND ss.created_at >= ${startDate}
              AND ss.created_at <= ${endDate}
            GROUP BY ss.sales_id, ss.total_amount, ss.discount
          ),
          returns AS (
            SELECT
              scr.sales_id,
              COALESCE(SUM(scr.refund_amount), 0)               AS total_refund,
              COALESCE(SUM(COALESCE(ssi.cp, 0) * scri.qty), 0) AS returned_cost
            FROM store_customer_returns scr
            INNER JOIN sold s ON s.sales_id = scr.sales_id
            LEFT JOIN store_customer_return_items scri ON scri.return_id = scr.return_id
            LEFT JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
            WHERE scr.owner_id = ${owner_id}
            GROUP BY scr.sales_id
          )
          SELECT
            COALESCE(SUM(s.effective_total), 0) - COALESCE(SUM(r.total_refund), 0) AS actual_revenue,
            COALESCE(SUM(s.sold_cost), 0) - COALESCE(SUM(r.returned_cost), 0)      AS net_cost
          FROM sold s
          LEFT JOIN returns r ON r.sales_id = s.sales_id
        `
      : await prisma.$queryRaw`
          WITH sold AS (
            SELECT
              ss.sales_id,
              GREATEST(ss.total_amount - COALESCE(ss.discount, 0), 0) AS effective_total,
              COALESCE(SUM(COALESCE(ssi.cp, 0) * ssi.qty), 0)         AS sold_cost
            FROM store_sales_items ssi
            JOIN store_sales ss ON ss.sales_id = ssi.sales_id
            WHERE ss.owner_id = ${owner_id}
            GROUP BY ss.sales_id, ss.total_amount, ss.discount
          ),
          returns AS (
            SELECT
              scr.sales_id,
              COALESCE(SUM(scr.refund_amount), 0)               AS total_refund,
              COALESCE(SUM(COALESCE(ssi.cp, 0) * scri.qty), 0) AS returned_cost
            FROM store_customer_returns scr
            INNER JOIN sold s ON s.sales_id = scr.sales_id
            LEFT JOIN store_customer_return_items scri ON scri.return_id = scr.return_id
            LEFT JOIN store_sales_items ssi ON ssi.sales_item_id = scri.sales_item_id
            WHERE scr.owner_id = ${owner_id}
            GROUP BY scr.sales_id
          )
          SELECT
            COALESCE(SUM(s.effective_total), 0) - COALESCE(SUM(r.total_refund), 0) AS actual_revenue,
            COALESCE(SUM(s.sold_cost), 0) - COALESCE(SUM(r.returned_cost), 0)      AS net_cost
          FROM sold s
          LEFT JOIN returns r ON r.sales_id = s.sales_id
        `;

    const pr = profitRows[0] || {};
    const actualRevenue = Number(pr.actual_revenue || 0);
    const netCost = Number(pr.net_cost || 0);

    const productCount = await prisma.storeProduct.count({ where: { owner_id } });
    const itemCount = await prisma.storeProduct.count({ where: { owner_id, type: "item" } });
    const serviceCount = await prisma.storeProduct.count({ where: { owner_id, type: "service" } });

    return {
      sales: {
        total_amount:     Number(sr.total_amount   || 0),
        total_discount:   Number(sr.total_discount || 0),
        effective_total:  Number(sr.effective_total|| 0),
        paid_amount:      Number(sr.total_paid     || 0),
        due_amount:       Number(sr.total_due      || 0),
        count:            Number(sr.sales_count    || 0),
      },
      profit: {
        actual_revenue: actualRevenue,
        total_cost:     netCost,
        profit:         actualRevenue - netCost,
      },
      products: {
        total:    productCount,
        items:    itemCount,
        services: serviceCount,
      },
    };
  }

  async _getSalesChart(owner_id, startDate, endDate) {
    const rows = await prisma.$queryRaw`
      WITH sales_base AS (
        SELECT
          date_trunc('day', ss.created_at)                                      AS period,
          GREATEST(ss.total_amount - COALESCE(ss.discount, 0), 0)              AS effective_total,
          ss.paid_amount
        FROM store_sales ss
        WHERE ss.owner_id = ${owner_id}
          AND ss.created_at >= ${startDate}
          AND ss.created_at <= ${endDate}
      ),
      sales_grouped AS (
        SELECT period,
          SUM(effective_total)::numeric AS effective_total,
          SUM(paid_amount)::numeric     AS paid_total
        FROM sales_base
        GROUP BY period
      ),
      cost_grouped AS (
        SELECT
          date_trunc('day', ss.created_at) AS period,
          COALESCE(SUM(COALESCE(ssi.cp, 0) * ssi.qty), 0)::numeric AS cost
        FROM store_sales_items ssi
        JOIN store_sales ss ON ss.sales_id = ssi.sales_id
        WHERE ss.owner_id = ${owner_id}
          AND ss.created_at >= ${startDate}
          AND ss.created_at <= ${endDate}
        GROUP BY 1
      ),
      returns_grouped AS (
        SELECT
          date_trunc('day', scr.created_at) AS period,
          SUM(scr.refund_amount)::numeric   AS refund_total
        FROM store_customer_returns scr
        WHERE scr.owner_id = ${owner_id}
          AND scr.created_at >= ${startDate}
          AND scr.created_at <= ${endDate}
        GROUP BY 1
      )
      SELECT
        COALESCE(sg.period, cg.period, rg.period)   AS period,
        COALESCE(sg.effective_total, 0)             AS effective_sales,
        COALESCE(cg.cost, 0)                        AS cost,
        COALESCE(sg.paid_total, 0)                  AS paid,
        COALESCE(rg.refund_total, 0)                AS refund
      FROM sales_grouped sg
      FULL OUTER JOIN cost_grouped cg ON cg.period = sg.period
      FULL OUTER JOIN returns_grouped rg ON rg.period = COALESCE(sg.period, cg.period)
      ORDER BY period ASC;
    `;

    return rows.map((r) => {
      const sales   = Number(r.effective_sales || 0) - Number(r.refund || 0);
      const cost    = Number(r.cost  || 0);
      const profit  = sales - cost;
      return {
        period:  new Date(r.period).toISOString(),
        sales,
        cost,
        paid:    Number(r.paid   || 0),
        refund:  Number(r.refund || 0),
        profit,
      };
    });
  }

  async _getRecentActivities(owner_id, limit = 6) {
    const per = Math.max(10, limit * 3);

    const [products, lots, sales, returns] = await Promise.all([
      prisma.storeProduct.findMany({
        where: { owner_id },
        orderBy: { created_at: "desc" },
        take: per,
        select: {
          product_id: true, product_name: true, type: true, created_at: true,
          category: { select: { category_name: true } },
        },
      }),
      prisma.storeStockLot.findMany({
        where: { owner_id },
        orderBy: { created_at: "desc" },
        take: per,
        select: {
          lot_id: true, qty_in: true, created_at: true,
          product: { select: { product_id: true, product_name: true, unit: { select: { unit_name: true } } } },
          supplier: { select: { supplier_name: true } },
        },
      }),
      prisma.storeSales.findMany({
        where: { owner_id },
        orderBy: { created_at: "desc" },
        take: per,
        select: {
          sales_id: true, total_amount: true, discount: true,
          paid_amount: true, payment_status: true, created_at: true,
          customer: { select: { full_name: true, phone: true } },
        },
      }),
      prisma.storeCustomerReturn.findMany({
        where: { owner_id },
        orderBy: { created_at: "desc" },
        take: per,
        select: {
          return_id: true, sales_id: true, refund_amount: true, created_at: true,
          sales: { select: { customer: { select: { full_name: true } } } },
        },
      }),
    ]);

    const activities = [];

    for (const p of products) {
      activities.push({
        type: "PRODUCT_CREATED",
        created_at: p.created_at,
        title: "Product added",
        message: `${p.product_name} (${p.type})${p.category ? " • " + p.category.category_name : ""}`,
        ref: { product_id: p.product_id },
      });
    }

    for (const l of lots) {
      const unit = l.product?.unit?.unit_name || "units";
      activities.push({
        type: "STOCK_IN",
        created_at: l.created_at,
        title: "Stock in",
        message: `${l.product?.product_name || "Product"} • +${l.qty_in} ${unit}${l.supplier ? " • " + l.supplier.supplier_name : ""}`,
        ref: { lot_id: l.lot_id, product_id: l.product?.product_id },
      });
    }

    for (const s of sales) {
      const effectiveTotal = Number(s.total_amount) - Number(s.discount || 0);
      const customer = s.customer?.full_name || "Walk-in";
      const disc = Number(s.discount || 0);
      activities.push({
        type: "SALE",
        created_at: s.created_at,
        title: "Sale",
        message: `${customer} • Rs.${effectiveTotal}${disc > 0 ? ` (Disc: ${disc})` : ""} • ${s.payment_status}`,
        ref: { sales_id: s.sales_id },
      });
    }

    for (const r of returns) {
      const customer = r.sales?.customer?.full_name || "Customer";
      activities.push({
        type: "CUSTOMER_RETURN",
        created_at: r.created_at,
        title: "Customer return",
        message: `${customer} • Refund Rs.${Number(r.refund_amount || 0)}`,
        ref: { return_id: r.return_id, sales_id: r.sales_id },
      });
    }

    activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return activities.slice(0, limit);
  }

  // async _getLowStockItems(owner_id, threshold = 40) {
  //   const rows = await prisma.$queryRaw`
  //     SELECT
  //       p.product_id,
  //       p.product_name,
  //       u.unit_name,
  //       COALESCE(SUM(sl.qty_remaining), 0)::int AS total_qty
  //     FROM store_products p
  //     LEFT JOIN store_stock_lots sl ON sl.product_id = p.product_id AND sl.owner_id = p.owner_id
  //     LEFT JOIN store_units u ON u.unit_id = p.unit_id
  //     WHERE p.owner_id = ${owner_id}
  //       AND p.type = 'item'
  //     GROUP BY p.product_id, p.product_name, u.unit_name
  //     HAVING COALESCE(SUM(sl.qty_remaining), 0) < ${threshold}
  //     ORDER BY total_qty ASC
  //     LIMIT 10;
  //   `;

  //   return rows.map((r) => ({
  //     product_id:   r.product_id,
  //     product_name: r.product_name,
  //     unit:         r.unit_name || "units",
  //     qty_remaining: Number(r.total_qty),
  //   }));
  // }
  async _getLowStockItems(owner_id, threshold = 40, limit = 10) {
    const rows = await prisma.$queryRaw`
      SELECT
        p.product_id,
        p.product_name,
        u.unit_name,
        COALESCE(SUM(sl.qty_remaining), 0)::int AS total_qty
      FROM store_products p
      LEFT JOIN store_stock_lots sl ON sl.product_id = p.product_id AND sl.owner_id = p.owner_id
      LEFT JOIN store_units u ON u.unit_id = p.unit_id
      WHERE p.owner_id = ${owner_id}
        AND p.type = 'item'
      GROUP BY p.product_id, p.product_name, u.unit_name
      HAVING COALESCE(SUM(sl.qty_remaining), 0) < ${threshold}
      ORDER BY total_qty ASC
      LIMIT ${limit};
    `;

    return rows.map((r) => ({
      product_id:    r.product_id,
      product_name:  r.product_name,
      unit:          r.unit_name || "units",
      qty_remaining: Number(r.total_qty),
    }));
  }
  async getInventoryValue(owner_id) {
    const rows = await prisma.$queryRaw`
      SELECT
        COALESCE(SUM(qty_remaining), 0)::int                    AS total_qty,
        COALESCE(SUM(cp::numeric * qty_remaining), 0)::numeric  AS total_cost_value
      FROM store_stock_lots
      WHERE owner_id = ${owner_id}
        AND qty_remaining > 0
    `;

    const r = rows[0] || {};
    return {
      total_qty_remaining: Number(r.total_qty || 0),
      total_cost_value:    Number(Number(r.total_cost_value || 0).toFixed(2)),
    };
  }
  async getLowStockItems(owner_id, threshold = 40, limit = 10) {
    return this._getLowStockItems(owner_id, threshold, limit);
  }

  async getRecentActivities(owner_id, limit = 6) {
    return this._getRecentActivities(owner_id, limit);
  }
}
export default new StoreDashboardService();
