const { prisma } = require("../prisma/client"); // IMPORTANT: use { prisma }

class ClothingInventoryService {
  // 1) Inventory list
  async listProducts(owner_id, { search, category_id }) {
    const where = {
      owner_id,
      ...(category_id ? { category_id } : {}),
      ...(search
        ? { product_name: { contains: String(search).trim(), mode: "insensitive" } }
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

    const mapQty = new Map(sums.map(s => [s.product_id, Number(s._sum.qty_remaining || 0)]));

    return products.map(p => ({
      ...p,
      total_qty_remaining: mapQty.get(p.product_id) ?? 0,
    }));
  }

  // 2) Product details with all lots (variants)
  async getProductDetails(owner_id, product_id) {
    const product = await prisma.clothingProduct.findFirst({
      where: { product_id, owner_id },
      select: {
        product_id: true,
        product_name: true,
        category: { select: { category_id: true, category_name: true } },
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
      where: { product_id ,product: { owner_id },},
      orderBy: [{ created_at: "desc" }],
      include: {
        supplier: { select: { supplier_id: true, supplier_name: true, phone: true } },
        size: { select: { size_id: true, size_name: true } },
        color: { select: { color_id: true, color_name: true } },
      },
    });

    const total_qty_remaining = lots.reduce((a, l) => a + Number(l.qty_remaining || 0), 0);

    return {
      product,
      total_qty_remaining,
      lots: lots.map(l => ({
        lot_id: l.lot_id,
        supplier: l.supplier,
        color: l.color,
        size: l.size,
        cp: Number(l.cp),
        sp: Number(l.sp),
        qty_in: l.qty_in,
        qty_remaining: l.qty_remaining,
        notes: l.notes,
        created_at: l.created_at,
      })),
    };
  }

  // 3) Update single lot (notes + qty)
  // Supports:
  // - notes change
  // - set cp/sp optional
  // - change qty_remaining safely (delta or set)
  // src/services/clothingInventoryService.js


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
  const sold = oldIn - oldRem; // already sold qty from this lot (cannot reduce below this)

  const hasQtyIn = qty_in !== undefined;
  const hasQtyRem = qty_remaining !== undefined;

  let newIn = oldIn;
  let newRem = oldRem;

  // validate qty_in if provided
  if (hasQtyIn) {
    const q = Number(qty_in);
    if (!Number.isInteger(q) || q < 0) {
      const e = new Error("qty_in must be an integer >= 0");
      e.status = 400;
      e.code = "VALIDATION_QTY_IN_INVALID";
      throw e;
    }
    // qty_in cannot be less than already sold
    if (q < sold) {
      const e = new Error(
        `qty_in cannot be less than already sold qty (${sold}).`
      );
      e.status = 400;
      e.code = "QTY_IN_LT_SOLD";
      throw e;
    }
    newIn = q;
  }

  // validate qty_remaining if provided
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

  // if only qty_remaining is provided, keep qty_in same BUT ensure remaining <= qty_in
  // if remaining is bigger, either error or auto-raise qty_in. (I recommend ERROR for correctness)
  if (hasQtyRem && !hasQtyIn) {
    if (newRem > newIn) {
      const e = new Error("qty_remaining cannot be greater than qty_in");
      e.status = 400;
      e.code = "QTY_REMAINING_GT_QTY_IN";
      throw e;
    }
  }

  // if qty_in was changed but qty_remaining not provided,
  // keep sold qty same by recomputing remaining:
  if (hasQtyIn && !hasQtyRem) {
    newRem = newIn - sold;
  }

  // if both provided, final consistency checks:
  if (hasQtyIn && hasQtyRem) {
    if (newRem > newIn) {
      const e = new Error("qty_remaining cannot be greater than qty_in");
      e.status = 400;
      e.code = "QTY_REMAINING_GT_QTY_IN";
      throw e;
    }
    // also ensure sold qty is not changed to negative
    const newSold = newIn - newRem;
    if (newSold < sold) {
      const e = new Error(
        `You cannot reduce sold history. Already sold=${sold}, but new sold would be ${newSold}.`
      );
      e.status = 400;
      e.code = "SOLD_HISTORY_INVALID";
      throw e;
    }
  }

  // apply if qty fields changed
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

  // 4) Bulk upsert variants for product:
  // Payload example:
  // {
  //   supplier_id,
  //   cp,
  //   sp,
  //   notes,
  //   variants: [
  //     { color_id, sizes: [{ size_id, qty_in }] },
  //     ...
  //   ]
  // }
  //
  // Behavior:
  // - if lot exists => increment qty_in and qty_remaining by qty_in
  // - else create new lot
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

    // owner-safe product check (also gives category auto)
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

    // owner-safe supplier check
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

    if (!Number.isFinite(cpNum) || cpNum < 0 || !Number.isFinite(spNum) || spNum < 0) {
      const e = new Error("cp and sp must be valid numbers");
      e.status = 400;
      e.code = "VALIDATION_PRICE_INVALID";
      throw e;
    }

    // ✅ SPEED FIX: prefetch all colors + sizes BEFORE transaction (avoid tx timeout)
    const colorIds = [...new Set(variants.map(v => v.color_id).filter(Boolean))];

    const sizeIds = [
      ...new Set(
        variants.flatMap(v => (v.sizes || []).map(s => s.size_id).filter(Boolean))
      ),
    ];

    const [colors, sizes] = await Promise.all([
      prisma.clothingColor.findMany({ where: { color_id: { in: colorIds } }, select: { color_id: true } }),
      prisma.clothingSize.findMany({ where: { size_id: { in: sizeIds } }, select: { size_id: true } }),
    ]);

    const colorSet = new Set(colors.map(c => c.color_id));
    const sizeSet = new Set(sizes.map(s => s.size_id));

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

    // ✅ Now do minimal work inside transaction
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

            // find existing lot for same product+supplier+color+size
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
            category: product.category, // ✅ auto for UI
          },
          supplier,
          created_count: created.length,
          updated_count: updated.length,
          created,
          updated,
        };
      },
      { timeout: 20000 } // avoids the 5s interactive tx timeout for bigger payloads
    );
  }
}

module.exports = new ClothingInventoryService();
