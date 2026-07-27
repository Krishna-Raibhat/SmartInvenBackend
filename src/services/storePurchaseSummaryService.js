// src/services/storePurchaseSummaryService.js
import { prisma } from "../prisma/client.js";

class StorePurchaseSummaryService {
  
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

    const lotWhere = {
      owner_id,
      ...(hasDates && { created_at: dateFilter }),
    };

    // ── Previous period filter (for growth comparison) ─────────────
    let prevFilter = null;
    if (from && to) {
      const startMs = new Date(from).getTime();
      const endMs   = new Date(to);
      endMs.setHours(23, 59, 59, 999);
      const rangeMs = endMs.getTime() - startMs;
      prevFilter = {
        gte: new Date(startMs - rangeMs),
        lte: new Date(startMs - 1),
      };
    }

    // ── 1. Fetch lots, returns, and prev-period spend concurrently ──
    const [lots, returns, prevRows] = await Promise.all([
      prisma.storeStockLot.findMany({
        where: lotWhere,
        select: {
          lot_id: true,
          supplier_id: true,
          cp: true,
          qty_in: true,
          qty_remaining: true,
          created_at: true,
          product: {
            select: { product_name: true },
          },
          supplier: {
            select: {
              supplier_id: true,
              supplier_name: true,
              phone: true,
              due_amount: true,
              paid_amount: true,
              payment_status: true,
            },
          },
        },
        orderBy: { created_at: "asc" },
      }),
      // Fetch supplier returns in the same date range
      prisma.storeSupplierReturn.findMany({
        where: {
          owner_id,
          ...(hasDates && { created_at: dateFilter }),
        },
        select: {
          return_id: true,
          supplier_id: true,
          total_refund: true,
          created_at: true,
          supplier: {
            select: {
              supplier_id: true,
              supplier_name: true,
              phone: true,
              due_amount: true,
              paid_amount: true,
              payment_status: true,
            },
          },
          items: {
            select: {
              qty: true,
            },
          },
        },
      }),
      prevFilter
        ? prisma.$queryRaw`
            SELECT 
              (
                SELECT COALESCE(SUM(cp * qty_in), 0)::numeric 
                FROM store_stock_lots 
                WHERE owner_id = ${owner_id}
                  AND created_at >= ${prevFilter.gte}
                  AND created_at <= ${prevFilter.lte}
              ) AS total_purchases,
              (
                SELECT COALESCE(SUM(total_refund), 0)::numeric 
                FROM store_supplier_returns 
                WHERE owner_id = ${owner_id}
                  AND created_at >= ${prevFilter.gte}
                  AND created_at <= ${prevFilter.lte}
              ) AS total_returns
          `
        : Promise.resolve([{ total_purchases: 0, total_returns: 0 }]),
    ]);

    const prevPurchases = Number(prevRows[0]?.total_purchases || 0);
    const prevReturns = Number(prevRows[0]?.total_returns || 0);
    const prevSpend = prevPurchases - prevReturns;

    // ── 2. Aggregate per supplier (purchases) ─────────────────────
    const supplierMap = new Map();

    for (const lot of lots) {
      const sup = lot.supplier;
      if (!sup) continue;
      const sid = sup.supplier_id;
      const spend = Number(lot.cp) * lot.qty_in;

      if (!supplierMap.has(sid)) {
        supplierMap.set(sid, {
          supplier_id:         sid,
          supplier_name:       sup.supplier_name,
          phone:               sup.phone,
          payment_status:      sup.payment_status ?? "paid",
          due_amount:          Number(sup.due_amount ?? 0),
          paid_amount:         Number(sup.paid_amount ?? 0),
          total_spend:         0,
          total_returned:      0, // Track returns
          total_lots:          0,
          total_qty_purchased: 0,
          total_qty_returned:  0,
          total_qty_remaining: 0,
          last_purchased_at:   null,
          top_product:         null,
          _productSpend:       new Map(), // product_name → spend (for top product)
        });
      }

      const se = supplierMap.get(sid);
      se.total_spend         += spend;
      se.total_lots          += 1;
      se.total_qty_purchased += lot.qty_in;
      se.total_qty_remaining += Number(lot.qty_remaining);

      // Track latest purchase date
      if (!se.last_purchased_at || lot.created_at > se.last_purchased_at) {
        se.last_purchased_at = lot.created_at;
      }

      // Track top product by spend
      const pName = lot.product?.product_name ?? "Unknown";
      se._productSpend.set(pName, (se._productSpend.get(pName) ?? 0) + spend);
    }

    // ── 2b. Subtract returns per supplier ──────────────────────────
    for (const ret of returns) {
      const sup = ret.supplier;
      if (!sup) continue;
      const sid = sup.supplier_id;

      if (!supplierMap.has(sid)) {
        supplierMap.set(sid, {
          supplier_id:         sid,
          supplier_name:       sup.supplier_name,
          phone:               sup.phone,
          payment_status:      sup.payment_status ?? "paid",
          due_amount:          Number(sup.due_amount ?? 0),
          paid_amount:         Number(sup.paid_amount ?? 0),
          total_spend:         0,
          total_returned:      0, // Track returns
          total_lots:          0,
          total_qty_purchased: 0,
          total_qty_returned:  0,
          total_qty_remaining: 0,
          last_purchased_at:   null,
          top_product:         null,
          _productSpend:       new Map(),
        });
      }

      const returnedQty = (ret.items || []).reduce((sum, item) => sum + (item.qty || 0), 0);
      supplierMap.get(sid).total_returned += Number(ret.total_refund || 0);
      supplierMap.get(sid).total_qty_returned += returnedQty;
    }

    // ── 3. Shape supplier list ────────────────────────────────────
    const suppliers = [...supplierMap.values()]
      .map((s) => {
        // Top product = highest spend product from this supplier
        let topProduct = null;
        let topSpend = 0;
        for (const [name, sp] of s._productSpend) {
          if (sp > topSpend) { topSpend = sp; topProduct = name; }
        }

        const fmtDate = (d) => {
          if (!d) return null;
          return d.toISOString().slice(0, 10); // 'YYYY-MM-DD'
        };

        const netSpend = s.total_spend - s.total_returned;
        // total_qty_purchased stays GROSS (units actually bought) — never
        // goes negative, even for a supplier with returns but no new lots
        // in this period. Returned units are reported separately.
        const netQtyPurchased = s.total_qty_purchased - s.total_qty_returned;

        return {
          supplier_id:         s.supplier_id,
          supplier_name:       s.supplier_name,
          phone:               s.phone,
          payment_status:      s.payment_status,
          total_spend:         Number(s.total_spend.toFixed(2)),
          total_returned:      Number(s.total_returned.toFixed(2)),
          net_spend:           Number(netSpend.toFixed(2)),
          total_lots:          s.total_lots,
          total_qty_purchased: s.total_qty_purchased,
          total_qty_returned:  s.total_qty_returned,
          net_qty_purchased:   netQtyPurchased,
          total_qty_remaining: Math.round(s.total_qty_remaining),
          due_amount:          Number(s.due_amount.toFixed(2)),
          paid_amount:         Number(s.paid_amount.toFixed(2)),
          last_purchased_at:   fmtDate(s.last_purchased_at),
          top_product:         topProduct ?? "—",
        };
      })
      .sort((a, b) => b.net_spend - a.net_spend); // Sort by net spend

    // ── 4. Summary KPIs ───────────────────────────────────────────
    const totalSpend         = suppliers.reduce((s, x) => s + x.total_spend, 0);
    const totalReturned      = returns.reduce((sum, r) => sum + Number(r.total_refund || 0), 0);
    const netSpend           = totalSpend - totalReturned;
    const totalLots          = suppliers.reduce((s, x) => s + x.total_lots, 0);
    // Gross units bought (never negative) + units returned, reported separately.
    const totalQtyPurchased  = suppliers.reduce((s, x) => s + x.total_qty_purchased, 0);
    const totalQtyReturned   = suppliers.reduce((s, x) => s + x.total_qty_returned, 0);
    const totalQtyRemaining  = suppliers.reduce((s, x) => s + x.total_qty_remaining, 0);
    const totalSuppliers     = suppliers.length;

    // Due breakdown — calculate ACTUAL dues dynamically from lots (not from DB field)
    // The due_amount field in DB is only updated on manual payment, not on purchase.
    // So we calculate: (total purchased - total returned) - total paid for each supplier
    let unpaidDue = 0;
    let partialDue = 0;

    // Calculate dues for ALL suppliers (not just those in current date range)
    const allSuppliers = await prisma.storeSupplier.findMany({
      where: { owner_id },
      select: { supplier_id: true, paid_amount: true },
    });

    for (const supplier of allSuppliers) {
      const supplierId = supplier.supplier_id;
      
      // Get all lots for this supplier (all-time, not date-filtered)
      const supplierLots = await prisma.storeStockLot.findMany({
        where: { owner_id, supplier_id: supplierId },
        select: { cp: true, qty_in: true },
      });

      // Get all returns for this supplier (all-time)
      const supplierReturns = await prisma.storeSupplierReturn.aggregate({
        where: { owner_id, supplier_id: supplierId },
        _sum: { total_refund: true },
      });

      // Calculate total purchased
      const totalPurchased = supplierLots.reduce((sum, lot) => {
        return sum + (Number(lot.cp) * Number(lot.qty_in));
      }, 0);

      // Calculate total returned
      const totalRefunded = Number(supplierReturns._sum.total_refund ?? 0);

      // Net amount owed
      const netOwed = totalPurchased - totalRefunded;

      // Amount paid
      const paidAmount = Number(supplier.paid_amount ?? 0);

      // Calculate actual due
      const actualDue = Math.max(netOwed - paidAmount, 0);

      if (actualDue <= 0) {
        continue; // No due
      }

      // Categorize based on payment made
      if (paidAmount === 0 && actualDue > 0) {
        // Nothing paid yet - unpaid
        unpaidDue += actualDue;
      } else if (paidAmount > 0 && actualDue > 0) {
        // Partially paid
        partialDue += actualDue;
      }
    }

    const vsLastPeriod = prevSpend > 0
      ? Number((((netSpend - prevSpend) / prevSpend) * 100).toFixed(1))
      : 0;

    // ── 5. Daily spend trend (purchases - returns) ────────────────
    const trendMap = new Map(); // 'YYYY-MM-DD' → {purchases, returns}

    for (const lot of lots) {
      const day   = lot.created_at.toISOString().slice(0, 10);
      const spend = Number(lot.cp) * lot.qty_in;
      if (!trendMap.has(day)) {
        trendMap.set(day, { purchases: 0, returns: 0 });
      }
      trendMap.get(day).purchases += spend;
    }

    for (const ret of returns) {
      const day = ret.created_at.toISOString().slice(0, 10);
      if (!trendMap.has(day)) {
        trendMap.set(day, { purchases: 0, returns: 0 });
      }
      trendMap.get(day).returns += Number(ret.total_refund || 0);
    }

    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const fmtDay = (iso) => {
      const d = new Date(iso);
      return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
    };

    const trend = [...trendMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([iso, data]) => ({
        d:        fmtDay(iso),
        purchases: Number(data.purchases.toFixed(2)),
        returns:   Number(data.returns.toFixed(2)),
        net:       Number((data.purchases - data.returns).toFixed(2)),
      }));

    return {
      summary: {
        total_spend:          Number(totalSpend.toFixed(2)),
        total_returned:       Number(totalReturned.toFixed(2)),
        net_spend:            Number(netSpend.toFixed(2)),
        total_lots:           totalLots,
        total_qty_purchased:  totalQtyPurchased,
        total_qty_returned:   totalQtyReturned,
        total_qty_remaining:  totalQtyRemaining,
        total_suppliers:      totalSuppliers,
        unpaid_due:           Number(unpaidDue.toFixed(2)),
        partial_due:          Number(partialDue.toFixed(2)),
        vs_last_period:       vsLastPeriod,
      },
      suppliers,
      trend,
    };
  }
}

export default new StorePurchaseSummaryService();