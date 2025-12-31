// src/services/clothingStockLotService.js
const { prisma } = require("../prisma/client");

class ClothingStockLotService {
  async bulkCreate(owner_id, payload) {
    const { product_id, supplier_id, cp, sp, notes, variants } = payload;

    if (!Array.isArray(variants) || variants.length === 0) {
      const e = new Error("At least one color variant is required");
      e.status = 400;
      e.code = "VALIDATION_NO_VARIANTS";
      throw e;
    }

    if (cp === undefined || sp === undefined) {
      const e = new Error("cp and sp are required");
      e.status = 400;
      e.code = "VALIDATION_PRICE_REQUIRED";
      throw e;
    }

    const cpNum = Number(cp);
    const spNum = Number(sp);
    if (!Number.isFinite(cpNum) || !Number.isFinite(spNum) || cpNum < 0 || spNum < 0) {
      const e = new Error("cp and sp must be valid numbers");
      e.status = 400;
      e.code = "VALIDATION_PRICE_INVALID";
      throw e;
    }

    // ✅ product must belong to owner + fetch category (for UI)
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

    // ✅ supplier must belong to owner
    const supplier = await prisma.clothingSupplier.findFirst({
      where: { supplier_id, owner_id },
      select: { supplier_id: true, supplier_name: true, phone: true },
    });
    if (!supplier) {
      const e = new Error("Supplier not found for this owner");
      e.status = 404;
      e.code = "SUPPLIER_NOT_FOUND";
      throw e;
    }

    // -------------------------
    // 1) Flatten request -> rows
    // -------------------------
    const rows = [];
    const seen = new Set(); // duplicates inside request

    for (const v of variants) {
      const color_id = String(v.color_id || "").trim();
      const sizes = v.sizes;

      if (!color_id) {
        const e = new Error("color_id is required");
        e.status = 400;
        e.code = "VALIDATION_COLOR_REQUIRED";
        throw e;
      }
      if (!Array.isArray(sizes) || sizes.length === 0) {
        const e = new Error("sizes[] is required for each color");
        e.status = 400;
        e.code = "VALIDATION_NO_SIZES";
        throw e;
      }

      for (const s of sizes) {
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

        const key = `${product_id}:${supplier_id}:${color_id}:${size_id}`;
        if (seen.has(key)) {
          const e = new Error("Duplicate size entry for same color");
          e.status = 400;
          e.code = "DUPLICATE_IN_REQUEST";
          throw e;
        }
        seen.add(key);

        rows.push({
          product_id,
          supplier_id,
          color_id,
          size_id,
          cp: cpNum,
          sp: spNum,
          qty_in,
          qty_remaining: qty_in,
          notes: notes ?? null,
        });
      }
    }

    // -------------------------
    // 2) Validate colors & sizes in ONE query each (outside tx)
    // -------------------------
    const colorIds = [...new Set(rows.map(r => r.color_id))];
    const sizeIds = [...new Set(rows.map(r => r.size_id))];

    const [colors, sizesFound] = await Promise.all([
      prisma.clothingColor.findMany({ where: { color_id: { in: colorIds } }, select: { color_id: true } }),
      prisma.clothingSize.findMany({ where: { size_id: { in: sizeIds } }, select: { size_id: true } }),
    ]);

    const colorSet = new Set(colors.map(c => c.color_id));
    const sizeSet = new Set(sizesFound.map(s => s.size_id));

    const missingColor = colorIds.find(id => !colorSet.has(id));
    if (missingColor) {
      const e = new Error(`Color not found: ${missingColor}`);
      e.status = 404;
      e.code = "COLOR_NOT_FOUND";
      throw e;
    }

    const missingSize = sizeIds.find(id => !sizeSet.has(id));
    if (missingSize) {
      const e = new Error(`Size not found: ${missingSize}`);
      e.status = 404;
      e.code = "SIZE_NOT_FOUND";
      throw e;
    }

    // -------------------------
    // 3) Check duplicates in DB in ONE query (owner-safe)
    // -------------------------
    const existingLots = await prisma.clothingStockLot.findMany({
      where: {
        product_id,
        supplier_id,
        OR: rows.map(r => ({ color_id: r.color_id, size_id: r.size_id })),
      },
      select: { color_id: true, size_id: true, lot_id: true },
    });

    if (existingLots.length) {
      const first = existingLots[0];
      const e = new Error("Stock lot already exists for this product/color/size/supplier");
      e.status = 409;
      e.code = "LOT_ALREADY_EXISTS";
      e.meta = { example: first };
      throw e;
    }

    // -------------------------
    // 4) Fast insert (transaction optional, but keep it safe)
    // -------------------------
    await prisma.$transaction(async (tx) => {
      await tx.clothingStockLot.createMany({
        data: rows,
      });
    });

    // -------------------------
    // 5) Return created lots (fetch after insert)
    // -------------------------
    const createdLots = await prisma.clothingStockLot.findMany({
      where: {
        product_id,
        supplier_id,
        OR: rows.map(r => ({ color_id: r.color_id, size_id: r.size_id })),
      },
      include: {
        product: { select: { product_name: true, category: { select: { category_name: true } } } },
        supplier: { select: { supplier_name: true, phone: true } },
        color: { select: { color_name: true } },
        size: { select: { size_name: true } },
      },
      orderBy: { created_at: "desc" },
    });

    return {
      product: {
        product_id: product.product_id,
        product_name: product.product_name,
        category: product.category,
      },
      supplier,
      lots: createdLots,
    };
  }
}

module.exports = new ClothingStockLotService();
