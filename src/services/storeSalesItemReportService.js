import { prisma } from "../prisma/client.js";

class StoreSalesItemReportService {
  async salesByItem(owner_id, { from, to } = {}) {
    const dateFilter = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const salesWhere = {
      owner_id,
      ...(Object.keys(dateFilter).length && { created_at: dateFilter }),
    };

    const itemWhere = {
      owner_id,
      sales: salesWhere,
      product: { type: "item" },
    };

    // ── 1. Raw sales items ──────────────────────────────────────────
    const salesItems = await prisma.storeSalesItem.findMany({
      where: itemWhere,
      select: {
        qty: true,
        cp: true,
        line_total: true,
        sales: { select: { created_at: true } },
        product: {
          select: {
            product_id: true,
            product_name: true,
            category: {
              select: { category_id: true, category_name: true },
            },
          },
        },
        lot: {
          select: {
            supplier: {
              select: { supplier_id: true, supplier_name: true },
            },
          },
        },
      },
    });

    // ── 2. Returns in date range ────────────────────────────────────
    const allReturnItems = await prisma.storeCustomerReturnItem.findMany({
      where: {
        owner_id,
        salesItem: { product: { type: "item" } },
      },
      select: {
        qty: true,
        amount: true,
        return: {
          select: {
            created_at: true,
          },
        },
        salesItem: {
          select: {
            product: {
              select: { product_id: true, product_name: true },
            },
          },
        },
      },
    });

    const returnItems = allReturnItems.filter((r) => {
      const createdAt = r.return?.created_at;
      if (!createdAt) return false;
      if (dateFilter.gte && createdAt < dateFilter.gte) return false;
      if (dateFilter.lte && createdAt > dateFilter.lte) return false;
      return true;
    });

    // ── 3. Low stock products (item type, owned) ────────────────────
    const lowStockLots = await prisma.storeStockLot.groupBy({
      by: ["product_id"],
      where: { owner_id },
      _sum: { qty_remaining: true },
    });

    const lowStockProductIds = lowStockLots
      .filter((l) => (l._sum.qty_remaining ?? 0) <= 10)
      .map((l) => l.product_id);

    const lowStockProducts = lowStockProductIds.length
      ? await prisma.storeProduct.findMany({
          where: {
            owner_id,
            product_id: { in: lowStockProductIds },
            type: "item",
          },
          select: {
            product_id: true,
            product_name: true,
            category: { select: { category_name: true } },
            stockLots: {
              where: { owner_id },
              select: { qty_remaining: true, qty_in: true },
            },
          },
        })
      : [];

    // ── 4. Aggregate summary ────────────────────────────────────────
    let totalSales = 0;
    let totalCogs = 0;
    let totalUnits = 0;

    const catMap = new Map();
    const prodMap = new Map();
    const supplierMap = new Map();
    const trendMap = new Map();

    for (const item of salesItems) {
      const lineTotal = Number(item.line_total);
      const qty = item.qty;
      const cp = Number(item.cp ?? 0);
      const cogs = cp * qty;

      totalSales += lineTotal;
      totalCogs += cogs;
      totalUnits += qty;

      // Category
      const cat = item.product.category;
      const catKey = cat?.category_id ?? "__uncat__";
      if (!catMap.has(catKey)) {
        catMap.set(catKey, {
          category_id: cat?.category_id ?? null,
          category_name: cat?.category_name ?? "Uncategorized",
          total_sales: 0,
          total_units: 0,
        });
      }
      const ce = catMap.get(catKey);
      ce.total_sales += lineTotal;
      ce.total_units += qty;

      // Product
      const pid = item.product.product_id;
      if (!prodMap.has(pid)) {
        prodMap.set(pid, {
          product_id: pid,
          product_name: item.product.product_name,
          category_name: cat?.category_name ?? "Uncategorized",
          total_sales: 0,
          total_units: 0,
          total_cogs: 0,
        });
      }
      const pe = prodMap.get(pid);
      pe.total_sales += lineTotal;
      pe.total_units += qty;
      pe.total_cogs += cogs;

      // Supplier
      const sup = item.lot?.supplier;
      if (sup) {
        const sk = sup.supplier_id;
        if (!supplierMap.has(sk)) {
          supplierMap.set(sk, {
            supplier_id: sk,
            supplier_name: sup.supplier_name,
            total_sales: 0,
            total_units: 0,
          });
        }
        const se = supplierMap.get(sk);
        se.total_sales += lineTotal;
        se.total_units += qty;
      }

      // Trend
      const day = item.sales.created_at.toISOString().slice(0, 10);
      trendMap.set(day, (trendMap.get(day) ?? 0) + lineTotal);
    }

    // ── 5. Returns aggregation ──────────────────────────────────────
    let totalReturnedUnits = 0;
    let totalRefundAmount = 0;

    for (const r of returnItems) {
      totalReturnedUnits += r.qty;
      totalRefundAmount += Number(r.amount);
    }

    const netSales = totalSales - totalRefundAmount;
    const grossProfit = totalSales - totalCogs;
    const netGrossProfit = grossProfit - totalRefundAmount;
    const marginPct =
      totalSales > 0
        ? Number(((grossProfit / totalSales) * 100).toFixed(1))
        : 0;

    // ── 6. Shape output ─────────────────────────────────────────────
    const categories = [...catMap.values()]
      .sort((a, b) => b.total_sales - a.total_sales)
      .map((c) => ({
        ...c,
        total_sales: Number(c.total_sales.toFixed(2)),
        share_percent:
          totalSales > 0
            ? Number(((c.total_sales / totalSales) * 100).toFixed(1))
            : 0,
      }));

    const top_products = [...prodMap.values()]
      .sort((a, b) => b.total_sales - a.total_sales)
      .slice(0, 10)
      .map((p) => ({
        ...p,
        total_sales: Number(p.total_sales.toFixed(2)),
        total_cogs: Number(p.total_cogs.toFixed(2)),
        gross_profit: Number((p.total_sales - p.total_cogs).toFixed(2)),
        margin_percent:
          p.total_sales > 0
            ? Number(
                (((p.total_sales - p.total_cogs) / p.total_sales) * 100).toFixed(1)
              )
            : 0,
      }));

    const suppliers = [...supplierMap.values()]
      .sort((a, b) => b.total_sales - a.total_sales)
      .map((s) => ({
        ...s,
        total_sales: Number(s.total_sales.toFixed(2)),
      }));

    const trend = [...trendMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date, total: Number(total.toFixed(2)) }));

    const low_stock = lowStockProducts.map((p) => {
      const totalRemaining = p.stockLots.reduce(
        (s, l) => s + l.qty_remaining,
        0
      );
      const totalIn = p.stockLots.reduce((s, l) => s + l.qty_in, 0);
      return {
        product_id: p.product_id,
        product_name: p.product_name,
        category_name: p.category?.category_name ?? "Uncategorized",
        qty_remaining: totalRemaining,
        qty_in: totalIn,
        level: totalRemaining <= 5 ? "critical" : "low",
      };
    });

    return {
      summary: {
        total_item_sales: Number(totalSales.toFixed(2)),
        total_units_sold: totalUnits,
        total_cogs: Number(totalCogs.toFixed(2)),
        gross_profit: Number(grossProfit.toFixed(2)),
        margin_percent: marginPct,
      },
      returns: {
        gross_sales: Number(totalSales.toFixed(2)),
        returned_units: totalReturnedUnits,
        refund_amount: Number(totalRefundAmount.toFixed(2)),
        net_sales: Number(netSales.toFixed(2)),
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