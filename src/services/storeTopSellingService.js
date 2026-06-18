// src/services/storeTopSellingService.js
import { prisma } from "../prisma/client.js";

class StoreTopSellingService {
  async getReport(owner_id, { from, to } = {}) {
    // ── Date range ─────────────────────────────────────────────────
    const dateFilter = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const hasDates = Object.keys(dateFilter).length > 0;

    const salesWhere = {
      owner_id,
      ...(hasDates && { created_at: dateFilter }),
    };

    // ── Previous period for growth comparison ──────────────────────
    let prevDateFilter = {};
    if (from && to) {
      const startMs = new Date(from).getTime();
      const endMs   = new Date(to);
      endMs.setHours(23, 59, 59, 999);
      const rangMs = endMs.getTime() - startMs;
      prevDateFilter = {
        gte: new Date(startMs - rangMs),
        lte: new Date(startMs - 1),
      };
    }

    // ── 1. Sales items (item-type only) ────────────────────────────
    const salesItems = await prisma.storeSalesItem.findMany({
      where: {
        owner_id,
        sales: salesWhere,
        product: { type: "item" },
      },
      select: {
        qty: true,
        cp: true,
        sp: true,
        line_total: true,
        product_id: true,
        sales: { select: { created_at: true } },
        product: {
          select: {
            product_name: true,
            cp: true,
            sp: true,
            category: { select: { category_id: true, category_name: true } },
            unit: { select: { unit_name: true } },
          },
        },
      },
    });

    // ── 2. Returns (item-type, filtered to same date range) ──────────
    const returnWhere = {
      owner_id,
      salesItem: { product: { type: "item" } },
      ...(hasDates && { return: { created_at: dateFilter } }),
    };

    const returnItems = await prisma.storeCustomerReturnItem.findMany({
      where: returnWhere,
      select: {
        qty: true,
        amount: true,
        salesItem: {
          select: {
            product_id: true,
            cp: true,
          },
        },
      },
    });

    // ── 3. Previous period revenue (for growth %) ──────────────────
    let prevRevenue = 0;
    let prevQty = 0;
    if (Object.keys(prevDateFilter).length) {
      const prevItems = await prisma.storeSalesItem.findMany({
        where: {
          owner_id,
          sales: {
            owner_id,
            created_at: prevDateFilter,
          },
          product: { type: "item" },
        },
        select: { qty: true, line_total: true },
      });
      prevRevenue = prevItems.reduce((s, i) => s + Number(i.line_total), 0);
      prevQty     = prevItems.reduce((s, i) => s + i.qty, 0);
    }

    // ── 4. Current stock per product ──────────────────────────────
    const stockGroups = await prisma.storeStockLot.groupBy({
      by: ["product_id"],
      where: { owner_id },
      _sum: { qty_remaining: true },
    });
    const stockMap = new Map(
      stockGroups.map((g) => [g.product_id, g._sum.qty_remaining ?? 0])
    );

    // ── 5. Aggregate per product ───────────────────────────────────
    const prodMap = new Map(); // product_id → aggregated data

    for (const item of salesItems) {
      const pid  = item.product_id;
      const qty  = item.qty;
      const lt   = Number(item.line_total);
      const cp   = Number(item.cp ?? item.product?.cp ?? 0);
      const sp   = Number(item.sp ?? item.product?.sp ?? 0);

      if (!prodMap.has(pid)) {
        prodMap.set(pid, {
          product_id:   pid,
          product_name: item.product.product_name,
          category:     item.product.category?.category_name ?? "Uncategorized",
          category_id:  item.product.category?.category_id ?? null,
          unit:         item.product.unit?.unit_name ?? "pcs",
          cp,
          sp,
          qty_sold:       0,
          revenue:        0,
          refunded_qty:   0,
          refund_amount:  0,
        });
      }

      const pe = prodMap.get(pid);
      pe.qty_sold += qty;
      pe.revenue  += lt;
    }

    // ── 6. Deduct returns per product ──────────────────────────────
    for (const r of returnItems) {
      const pid = r.salesItem?.product_id;
      if (!pid) continue;
      if (!prodMap.has(pid)) continue;
      const pe = prodMap.get(pid);
      pe.refunded_qty  += Number(r.qty ?? 0);
      pe.refund_amount += Number(r.amount ?? 0);
    }

    // ── 7. Sort by net revenue (descending), keep top 10 ──────────
    const allProducts = [...prodMap.values()]
      .map((p) => {
        const netRev  = p.revenue - p.refund_amount;
        const netQty  = p.qty_sold - p.refunded_qty;
        const margin  = p.sp > 0 ? ((p.sp - p.cp) / p.sp) * 100 : 0;
        return {
          ...p,
          revenue:        Number(netRev.toFixed(2)),
          qty_sold:       netQty,
          stock_remaining: stockMap.get(p.product_id) ?? 0,
          margin_percent:  Number(margin.toFixed(1)),
        };
      })
      .filter((p) => p.qty_sold > 0)
      .sort((a, b) => b.revenue - a.revenue);

    const top10 = allProducts.slice(0, 10);

    // ── 8. Summary KPIs ────────────────────────────────────────────
    const totalRevenue = top10.reduce((s, p) => s + p.revenue, 0);
    const totalQty     = top10.reduce((s, p) => s + p.qty_sold, 0);

    // Weighted average margin across top-10
    const avgMargin = totalRevenue > 0
      ? top10.reduce((s, p) => s + p.margin_percent * p.revenue, 0) / totalRevenue
      : 0;

    const bestSeller = top10[0] ?? null;

    const growthPct = prevRevenue > 0
      ? Number((((totalRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1))
      : 0;
    const qtyGrowth = prevQty > 0
      ? Number((((totalQty - prevQty) / prevQty) * 100).toFixed(1))
      : 0;

    // ── 9. Category breakdown ──────────────────────────────────────
    const catMap = new Map();
    for (const p of top10) {
      const key = p.category;
      catMap.set(key, (catMap.get(key) ?? 0) + p.revenue);
    }
    const catTotal = [...catMap.values()].reduce((s, v) => s + v, 0);
    const categories = [...catMap.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([name, total]) => ({
        name,
        total: Number(total.toFixed(2)),
        pct:   catTotal > 0 ? Number(((total / catTotal) * 100).toFixed(1)) : 0,
      }));

    // ── 10. Daily trend for top-5 products ────────────────────────
    // Format: [{ d: '10 Jun', ProductA: qty, ProductB: qty, ... }]
    const top5Names = top10.slice(0, 5).map((p) => p.product_name);
    const top5Ids   = top10.slice(0, 5).map((p) => p.product_id);

    const trendMap = new Map(); // 'YYYY-MM-DD' → { productName → qty }

    for (const item of salesItems) {
      if (!top5Ids.includes(item.product_id)) continue;
      const day     = item.sales.created_at.toISOString().slice(0, 10);
      const pName   = item.product.product_name;
      if (!trendMap.has(day)) {
        trendMap.set(day, {});
      }
      const entry = trendMap.get(day);
      entry[pName] = (entry[pName] ?? 0) + item.qty;
    }

    // Format day label as 'DD Mon'
    const fmt = (iso) => {
      const d = new Date(iso);
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
    };

    const trend = [...trendMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([iso, vals]) => {
        const row = { d: fmt(iso) };
        for (const name of top5Names) {
          row[name] = vals[name] ?? 0;
        }
        return row;
      });

    return {
      summary: {
        total_revenue:    Number(totalRevenue.toFixed(2)),
        total_qty_sold:   totalQty,
        avg_margin:       Number(avgMargin.toFixed(1)),
        best_seller:      bestSeller?.product_name ?? null,
        best_seller_qty:  bestSeller?.qty_sold ?? 0,
        growth_percent:   growthPct,
        qty_growth:       qtyGrowth,
      },
      products: top10,
      trend,
      categories,
    };
  }
}

export default new StoreTopSellingService();
