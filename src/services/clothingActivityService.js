// src/services/clothingActivityService.js
const { prisma } = require("../prisma/client");

class ClothingActivityService {
  async listRecent(owner_id, limit = 4) {
    const lim = Number(limit);
    const take = Number.isInteger(lim) && lim > 0 && lim <= 50 ? lim : 4;

    // Fetch small sets from each source (take a bit more than limit)
    const per = Math.max(10, take * 4);

    const [products, lots, sales, custReturns, suppReturns] = await Promise.all([
      prisma.clothingProduct.findMany({
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

      prisma.clothingStockLot.findMany({
        where: { product: { owner_id } },
        orderBy: { created_at: "desc" },
        take: per,
        select: {
          lot_id: true,
          product_id: true,
          qty_in: true,
          qty_remaining: true,
          created_at: true,
          product: { select: { product_name: true } },
          supplier: { select: { supplier_name: true } },
          color: { select: { color_name: true } },
          size: { select: { size_name: true } },
        },
      }),

      prisma.clothingSales.findMany({
        where: { owner_id },
        orderBy: { created_at: "desc" },
        take: per,
        select: {
          sales_id: true,
          total_amount: true,
          paid_amount: true,
          payment_status: true,
          created_at: true,
          customer: { select: { full_name: true, phone: true } },
        },
      }),

      prisma.clothingCustomerReturn.findMany({
        where: { owner_id },
        orderBy: { created_at: "desc" },
        take: per,
        select: {
          return_id: true,
          sales_id: true,
          refund_amount: true,
          created_at: true,
        },
      }),

      prisma.clothingSupplierReturn.findMany({
        where: { owner_id },
        orderBy: { created_at: "desc" },
        take: per,
        select: {
          return_id: true,
          supplier_id: true,
          status: true,
          created_at: true,
          supplier: { select: { supplier_name: true } },
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

    for (const l of lots) {
      const variant = `${l.color?.color_name || ""}${l.size?.size_name ? " / " + l.size.size_name : ""}`.trim();
      activities.push({
        type: "STOCK_IN",
        created_at: l.created_at,
        title: "Stock in",
        message: `${l.product?.product_name || "Product"} • ${variant} • +${l.qty_in} (Supplier: ${l.supplier?.supplier_name || "-"})`,
        ref: { lot_id: l.lot_id, product_id: l.product_id },
      });
    }

    for (const s of sales) {
      activities.push({
        type: "STOCK_OUT",
        created_at: s.created_at,
        title: "Sale (stock out)",
        message: `Bill ${s.sales_id} • Total ${Number(s.total_amount)} • Paid ${Number(s.paid_amount)} • ${s.payment_status}`,
        ref: { sales_id: s.sales_id },
      });
    }

    for (const r of custReturns) {
      activities.push({
        type: "CUSTOMER_RETURN",
        created_at: r.created_at,
        title: "Customer return",
        message: `Return ${r.return_id} • Sale ${r.sales_id || "-"} • Refund ${Number(r.refund_amount || 0)}`,
        ref: { return_id: r.return_id, sales_id: r.sales_id },
      });
    }

    // Supplier returns: show only completed OR show all (your choice)
    for (const r of suppReturns) {
      activities.push({
        type: "SUPPLIER_RETURN",
        created_at: r.created_at,
        title: "Supplier return",
        message: `Return ${r.return_id} • ${r.supplier?.supplier_name || "-"} • Status: ${r.status}`,
        ref: { return_id: r.return_id, supplier_id: r.supplier_id },
      });
    }

    // Sort newest first and take final limit
    activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return activities.slice(0, take);
  }
}

module.exports = new ClothingActivityService();
