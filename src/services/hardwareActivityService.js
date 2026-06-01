// src/services/hardwareActivityService.js
import { prisma } from "../prisma/client.js";

class HardwareActivityService {
  async listRecent(owner_id, limit = 4) {
    const lim = Number(limit);
    const take = Number.isInteger(lim) && lim > 0 && lim <= 50 ? lim : 4;

    // Fetch small sets from each source (take a bit more than limit)
    const per = Math.max(10, take * 4);

    const [products, stockIn, stockOut] = await Promise.all([
      prisma.hardwareProduct.findMany({
        where: { owner_id },
        orderBy: { created_at: "desc" },
        take: per,
        select: {
          product_id: true,
          product_name: true,
          created_at: true,
          category: { select: { category_name: true } },
        },
      }),

      prisma.hardwareStockLot.findMany({
        where: { product: { owner_id } },
        orderBy: { created_at: "desc" },
        take: per,
        select: {
          lot_id: true,
          product_id: true,
          qty_in: true,
          qty_remaining: true,
          cp: true,
          sp: true,
          created_at: true,
          product: { select: { product_name: true } },
          supplier: { select: { supplier_name: true } },
        },
      }),

      prisma.hardwareStockOut.findMany({
        where: { owner_id },
        orderBy: { created_at: "desc" },
        take: per,
        select: {
          stockout_id: true,
          customer_name: true,
          customer_phn_number: true,
          total_amount: true,
          paid_amount: true,
          payment_status: true,
          created_at: true,
        },
      }),
    ]);

    // Normalize to a single activity format
    const activities = [];

    for (const p of products) {
      activities.push({
        type: "PRODUCT_CREATED",
        created_at: p.created_at,
        title: "Product added",
        message: `${p.product_name} (${p.category?.category_name || "No category"})`,
        ref: { product_id: p.product_id },
      });
    }

    for (const l of stockIn) {
      activities.push({
        type: "STOCK_IN",
        created_at: l.created_at,
        title: "Stock in",
        message: `${l.product?.product_name || "Product"} • +${l.qty_in} units • CP: ${Number(l.cp)} • SP: ${Number(l.sp)} • Supplier: ${l.supplier?.supplier_name || "-"}`,
        ref: { lot_id: l.lot_id, product_id: l.product_id },
      });
    }

    for (const s of stockOut) {
      const customerInfo = s.customer_name || s.customer_phn_number || "Walk-in";
      activities.push({
        type: "STOCK_OUT",
        created_at: s.created_at,
        title: "Stock out (Sale)",
        message: `Customer: ${customerInfo} • Total: ${Number(s.total_amount)} • Paid: ${Number(s.paid_amount)} • ${s.payment_status}`,
        ref: { stockout_id: s.stockout_id },
      });
    }

    // Sort newest first and take final limit
    activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return activities.slice(0, take);
  }
}

export default new HardwareActivityService();
