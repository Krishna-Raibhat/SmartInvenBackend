import { prisma } from "../prisma/client.js";

class ClothingInventoryService {
  // 1) Inventory list
  async listProducts(owner_id, { search, category_id }) {
    const where = {
      owner_id,
      ...(category_id ? { category_id } : {}),
      ...(search
        ? {
            product_name: {
              contains: String(search).trim(),
              mode: "insensitive",
            },
          }
        : {}),
    };

    // load products + category
    const products = await prisma.clothingProduct.findMany({
      where,
      orderBy: { created_at: "desc" },
      select: {
        product_id: true,
        product_name: true,
        category: { select: { category_id: true, category_name: true } },
      },
      take: 500,
    });

    if (products.length === 0) return [];

    // group stock by product (owner safe via product.owner_id)
    const sums = await prisma.clothingStockLot.groupBy({
      by: ["product_id"],
      where: { product: { owner_id } },
      _sum: { qty_remaining: true },
    });

    const mapQty = new Map(
      sums.map((s) => [s.product_id, Number(s._sum.qty_remaining || 0)]),
    );

    return products.map((p) => ({
      ...p,
      total_qty_remaining: mapQty.get(p.product_id) ?? 0,
    }));
  }

  async getProductDetails(owner_id, product_id) {
    const product = await prisma.clothingProduct.findFirst({
      where: { product_id, owner_id },
      select: {
        product_id: true,
        product_name: true,
        category: {
          select: {
            category_id: true,
            category_name: true,
          },
        },
        created_at: true,
      },
    });

    if (!product) {
      const e = new Error("Product not found for this owner");
      e.status = 404;
      e.code = "PRODUCT_NOT_FOUND";
      throw e;
    }

    const lots = await prisma.clothingStockLot.findMany({
      where: {
        product_id,
        product: { owner_id },
      },
      orderBy: [{ created_at: "desc" }],
      include: {
        supplier: {
          select: {
            supplier_id: true,
            supplier_name: true,
            phone: true,
          },
        },
        size: {
          select: {
            size_id: true,
            size_name: true,
          },
        },
        color: {
          select: {
            color_id: true,
            color_name: true,
          },
        },
      },
    });

    const total_qty_remaining = lots.reduce(
      (a, l) => a + Number(l.qty_remaining || 0),
      0,
    );

    return {
      product,
      total_qty_remaining,
      lots: lots.map((l) => ({
        lot_id: l.lot_id,
        supplier: l.supplier,
        color: l.color,
        size: l.size,
        cp: Number(l.cp),
        sp: Number(l.sp),
        qty_in: l.qty_in,
        qty_remaining: l.qty_remaining,
        notes: l.notes,
        barcode: l.barcode ?? null,
        barcode_image_url: l.barcode_image_url ?? null,
        created_at: l.created_at,
      })),
    };
  }

  async updateLot(owner_id, lot_id, payload) {
    const { notes, cp, sp, qty_remaining, qty_in } = payload;

    const lot = await prisma.clothingStockLot.findFirst({
      where: { lot_id, product: { owner_id } },
      select: {
        lot_id: true,
        qty_remaining: true,
        qty_in: true,
      },
    });

    if (!lot) {
      const e = new Error("Stock lot not found");
      e.status = 404;
      e.code = "LOT_NOT_FOUND";
      throw e;
    }

    const data = {};

    // notes
    if (notes !== undefined) data.notes = notes ? String(notes) : null;

    // cp
    if (cp !== undefined) {
      const n = Number(cp);
      if (!Number.isFinite(n) || n < 0) {
        const e = new Error("cp must be a valid number");
        e.status = 400;
        e.code = "VALIDATION_CP_INVALID";
        throw e;
      }
      data.cp = n;
    }

    // sp
    if (sp !== undefined) {
      const n = Number(sp);
      if (!Number.isFinite(n) || n < 0) {
        const e = new Error("sp must be a valid number");
        e.status = 400;
        e.code = "VALIDATION_SP_INVALID";
        throw e;
      }
      data.sp = n;
    }

    const oldIn = Number(lot.qty_in);
    const oldRem = Number(lot.qty_remaining);
    const sold = oldIn - oldRem;

    const hasQtyIn = qty_in !== undefined;
    const hasQtyRem = qty_remaining !== undefined;

    let newIn = oldIn;
    let newRem = oldRem;

    if (hasQtyIn) {
      const q = Number(qty_in);
      if (!Number.isInteger(q) || q < 0) {
        const e = new Error("qty_in must be an integer >= 0");
        e.status = 400;
        e.code = "VALIDATION_QTY_IN_INVALID";
        throw e;
      }
      if (q < sold) {
        const e = new Error(
          `qty_in cannot be less than already sold qty (${sold}).`,
        );
        e.status = 400;
        e.code = "QTY_IN_LT_SOLD";
        throw e;
      }
      newIn = q;
    }

    if (hasQtyRem) {
      const q = Number(qty_remaining);
      if (!Number.isInteger(q) || q < 0) {
        const e = new Error("qty_remaining must be an integer >= 0");
        e.status = 400;
        e.code = "VALIDATION_QTY_REMAINING_INVALID";
        throw e;
      }
      newRem = q;
    }

    if (hasQtyRem && !hasQtyIn) {
      if (newRem > newIn) {
        const e = new Error("qty_remaining cannot be greater than qty_in");
        e.status = 400;
        e.code = "QTY_REMAINING_GT_QTY_IN";
        throw e;
      }
    }

    if (hasQtyIn && !hasQtyRem) {
      newRem = newIn - sold;
    }

    if (hasQtyIn && hasQtyRem) {
      if (newRem > newIn) {
        const e = new Error("qty_remaining cannot be greater than qty_in");
        e.status = 400;
        e.code = "QTY_REMAINING_GT_QTY_IN";
        throw e;
      }
      const newSold = newIn - newRem;
      if (newSold < sold) {
        const e = new Error(
          `You cannot reduce sold history. Already sold=${sold}, but new sold would be ${newSold}.`,
        );
        e.status = 400;
        e.code = "SOLD_HISTORY_INVALID";
        throw e;
      }
    }

    if (hasQtyIn) data.qty_in = newIn;
    if (hasQtyRem || hasQtyIn) data.qty_remaining = newRem;

    return prisma.clothingStockLot.update({
      where: { lot_id },
      data,
      include: {
        product: { select: { product_name: true } },
        supplier: { select: { supplier_name: true } },
        color: { select: { color_name: true } },
        size: { select: { size_name: true } },
      },
    });
  }

  async bulkUpsertLots(owner_id, product_id, payload) {
    const { supplier_id, cp, sp, notes, variants } = payload;

    if (!supplier_id) {
      const e = new Error("supplier_id is required");
      e.status = 400;
      e.code = "VALIDATION_SUPPLIER_REQUIRED";
      throw e;
    }

    if (!Array.isArray(variants) || variants.length === 0) {
      const e = new Error("variants[] is required");
      e.status = 400;
      e.code = "VALIDATION_NO_VARIANTS";
      throw e;
    }

    const product = await prisma.clothingProduct.findFirst({
      where: { product_id, owner_id },
      select: {
        product_id: true,
        product_name: true,
        category: { select: { category_id: true, category_name: true } },
      },
    });

    if (!product) {
      const e = new Error("Product not found for this owner");
      e.status = 404;
      e.code = "PRODUCT_NOT_FOUND";
      throw e;
    }

    const supplier = await prisma.clothingSupplier.findFirst({
      where: { supplier_id, owner_id },
      select: { supplier_id: true, supplier_name: true },
    });

    if (!supplier) {
      const e = new Error("Supplier not found for this owner");
      e.status = 404;
      e.code = "SUPPLIER_NOT_FOUND";
      throw e;
    }

    const cpNum = Number(cp);
    const spNum = Number(sp);

    if (
      !Number.isFinite(cpNum) ||
      cpNum < 0 ||
      !Number.isFinite(spNum) ||
      spNum < 0
    ) {
      const e = new Error("cp and sp must be valid numbers");
      e.status = 400;
      e.code = "VALIDATION_PRICE_INVALID";
      throw e;
    }

    const colorIds = [
      ...new Set(variants.map((v) => v.color_id).filter(Boolean)),
    ];

    const sizeIds = [
      ...new Set(
        variants.flatMap((v) =>
          (v.sizes || []).map((s) => s.size_id).filter(Boolean),
        ),
      ),
    ];

    const [colors, sizes] = await Promise.all([
      prisma.clothingColor.findMany({
        where: { color_id: { in: colorIds } },
        select: { color_id: true },
      }),
      prisma.clothingSize.findMany({
        where: { size_id: { in: sizeIds } },
        select: { size_id: true },
      }),
    ]);

    const colorSet = new Set(colors.map((c) => c.color_id));
    const sizeSet = new Set(sizes.map((s) => s.size_id));

    for (const cid of colorIds) {
      if (!colorSet.has(cid)) {
        const e = new Error("Color not found");
        e.status = 404;
        e.code = "COLOR_NOT_FOUND";
        throw e;
      }
    }
    for (const sid of sizeIds) {
      if (!sizeSet.has(sid)) {
        const e = new Error("Size not found");
        e.status = 404;
        e.code = "SIZE_NOT_FOUND";
        throw e;
      }
    }

    return prisma.$transaction(
      async (tx) => {
        const created = [];
        const updated = [];

        for (const v of variants) {
          const color_id = String(v.color_id || "").trim();
          if (!color_id) {
            const e = new Error("color_id is required");
            e.status = 400;
            e.code = "VALIDATION_COLOR_REQUIRED";
            throw e;
          }

          if (!Array.isArray(v.sizes) || v.sizes.length === 0) {
            const e = new Error("sizes[] is required for each color");
            e.status = 400;
            e.code = "VALIDATION_NO_SIZES";
            throw e;
          }

          for (const s of v.sizes) {
            const size_id = String(s.size_id || "").trim();
            const qty_in = Number(s.qty_in);

            if (!size_id) {
              const e = new Error("size_id is required");
              e.status = 400;
              e.code = "VALIDATION_SIZE_REQUIRED";
              throw e;
            }
            if (!Number.isInteger(qty_in) || qty_in <= 0) {
              const e = new Error("qty_in must be a positive integer");
              e.status = 400;
              e.code = "VALIDATION_QTY_INVALID";
              throw e;
            }

            const existing = await tx.clothingStockLot.findFirst({
              where: { product_id, supplier_id, color_id, size_id },
              select: { lot_id: true },
            });

            if (existing) {
              const lot = await tx.clothingStockLot.update({
                where: { lot_id: existing.lot_id },
                data: {
                  cp: cpNum,
                  sp: spNum,
                  notes: notes ?? null,
                  qty_in: { increment: qty_in },
                  qty_remaining: { increment: qty_in },
                },
              });
              updated.push(lot);
            } else {
              const lot = await tx.clothingStockLot.create({
                data: {
                  product_id,
                  supplier_id,
                  color_id,
                  size_id,
                  cp: cpNum,
                  sp: spNum,
                  qty_in,
                  qty_remaining: qty_in,
                  notes: notes ?? null,
                },
              });
              created.push(lot);
            }
          }
        }

        return {
          product: {
            product_id: product.product_id,
            product_name: product.product_name,
            category: product.category,
          },
          supplier,
          created_count: created.length,
          updated_count: updated.length,
          created,
          updated,
        };
      },
      { timeout: 20000 },
    );
  }

  async getAverageCost(owner_id) {
    // Get all products for this owner
    const products = await prisma.clothingProduct.findMany({
      where: { owner_id },
      select: { product_id: true, product_name: true },
    });

    if (products.length === 0) {
      return null;
    }

    const productIds = products.map(p => p.product_id);

    // Get all lots with remaining stock across all products
    const lots = await prisma.clothingStockLot.findMany({
      where: { 
        product_id: { in: productIds },
        product: { owner_id },
        qty_remaining: { gt: 0 }
      },
      select: {
        lot_id: true,
        product_id: true,
        cp: true,
        qty_remaining: true,
      },
    });

    if (lots.length === 0) {
      return {
        total_products: products.length,
        total_products_with_stock: 0,
        total_qty_remaining: 0,
        weighted_average_cp: 0,
        total_inventory_value: 0,
      };
    }

    // Calculate weighted average CP across all products
    let totalCost = 0;
    let totalQty = 0;
    const productsWithStock = new Set();

    lots.forEach(lot => {
      const cp = Number(lot.cp);
      const qty = lot.qty_remaining;
      const lotCost = cp * qty;

      totalCost += lotCost;
      totalQty += qty;
      productsWithStock.add(lot.product_id);
    });

    const weightedAverageCp = totalQty > 0 ? totalCost / totalQty : 0;

    return {
      total_products: products.length,
      total_products_with_stock: productsWithStock.size,
      total_qty_remaining: totalQty,
      weighted_average_cp: Number(weightedAverageCp.toFixed(2)),
      total_inventory_value: Number(totalCost.toFixed(2)),
    };
  }
}

export default new ClothingInventoryService();
