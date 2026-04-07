// src/services/clothingSupplierLotsService.js
const { prisma } = require("../prisma/client");

class ClothingSupplierLotsService {
  async listLots(owner_id, supplier_id, { search, product_id, only_in_stock } = {}) {
    // supplier must belong to owner
    const supplier = await prisma.clothingSupplier.findFirst({
      where: { supplier_id, owner_id },
      select: { supplier_id: true },
    });
    if (!supplier) {
      const e = new Error("Supplier not found for this owner");
      e.status = 404;
      e.code = "SUPPLIER_NOT_FOUND";
      throw e;
    }

    const where = {
      supplier_id,
      // owner-safe: lot.product.owner_id
      product: { owner_id },
      ...(product_id ? { product_id } : {}),
      ...(only_in_stock === "1" || only_in_stock === true
        ? { qty_remaining: { gt: 0 } }
        : {}),
      ...(search
        ? {
            product: {
              owner_id,
              product_name: { contains: String(search).trim(), mode: "insensitive" },
            },
          }
        : {}),
    };

    const lots = await prisma.clothingStockLot.findMany({
      where,
      orderBy: [{ created_at: "desc" }],
      select: {
        lot_id: true,
        qty_in: true,
        qty_remaining: true,
        cp: true,
        sp: true,
        notes: true,
        created_at: true,
        product: {
          select: {
            product_id: true,
            product_name: true,
            category: { select: { category_id: true, category_name: true } },
          },
        },
        color: { select: { color_id: true, color_name: true } },
        size: { select: { size_id: true, size_name: true } },
      },
      take: 1000,
    });

    // normalize decimals
    return lots.map((l) => ({
      ...l,
      cp: Number(l.cp),
      sp: Number(l.sp),
    }));
  }
}

module.exports = new ClothingSupplierLotsService();