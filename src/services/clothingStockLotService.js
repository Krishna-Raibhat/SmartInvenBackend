// src/services/clothingStockLotService.js
const prisma = require("../prisma/client");

class ClothingStockLotService {
  async bulkCreate(owner_id, payload) {
    const { product_id, supplier_id, notes, variants } = payload;

    if (!Array.isArray(variants) || variants.length === 0) {
      const e = new Error("At least one color variant is required");
      e.status = 400;
      e.code = "VALIDATION_NO_VARIANTS";
      throw e;
    }

    // product must belong to owner
    const product = await prisma.clothingProduct.findFirst({
      where: { product_id, owner_id },
      select: { product_id: true },
    });
    if (!product) {
      const e = new Error("Product not found for this owner");
      e.status = 404;
      e.code = "PRODUCT_NOT_FOUND";
      throw e;
    }

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

    return prisma.$transaction(async (tx) => {
      const created = [];
      const seen = new Set(); // prevent duplicates inside request

      for (const v of variants) {
        const { color_id, cp, sp, sizes } = v;

        if (!color_id) {
          const e = new Error("color_id is required");
          e.status = 400;
          e.code = "VALIDATION_COLOR_REQUIRED";
          throw e;
        }

        if (cp === undefined || sp === undefined) {
          const e = new Error("cp and sp are required for each color");
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

        if (!Array.isArray(sizes) || sizes.length === 0) {
          const e = new Error("sizes[] is required for each color");
          e.status = 400;
          e.code = "VALIDATION_NO_SIZES";
          throw e;
        }

        // ensure color exists
        const color = await tx.clothingColor.findUnique({
          where: { color_id },
          select: { color_id: true },
        });
        if (!color) {
          const e = new Error("Color not found");
          e.status = 404;
          e.code = "COLOR_NOT_FOUND";
          throw e;
        }

        for (const s of sizes) {
          const { size_id, qty_in } = s;

          if (!size_id) {
            const e = new Error("size_id is required");
            e.status = 400;
            e.code = "VALIDATION_SIZE_REQUIRED";
            throw e;
          }

          const q = Number(qty_in);
          if (!Number.isInteger(q) || q <= 0) {
            const e = new Error("qty_in must be a positive integer");
            e.status = 400;
            e.code = "VALIDATION_QTY_INVALID";
            throw e;
          }

          // ensure size exists
          const size = await tx.clothingSize.findUnique({
            where: { size_id },
            select: { size_id: true },
          });
          if (!size) {
            const e = new Error("Size not found");
            e.status = 404;
            e.code = "SIZE_NOT_FOUND";
            throw e;
          }

          // prevent duplicates in SAME request
          const key = `${product_id}:${supplier_id}:${color_id}:${size_id}`;
          if (seen.has(key)) {
            const e = new Error("Duplicate size entry for same color");
            e.status = 400;
            e.code = "DUPLICATE_IN_REQUEST";
            throw e;
          }
          seen.add(key);

          // prevent duplicates in DB (optional but recommended)
          const exists = await tx.clothingStockLot.findFirst({
            where: { product_id, supplier_id, color_id, size_id },
            select: { lot_id: true },
          });
          if (exists) {
            const e = new Error("Stock lot already exists for this product/color/size/supplier");
            e.status = 409;
            e.code = "LOT_ALREADY_EXISTS";
            throw e;
          }

          const lot = await tx.clothingStockLot.create({
            data: {
              product_id,
              supplier_id,
              color_id,
              size_id,
              cp: cpNum,
              sp: spNum,
              qty_in: q,
              qty_remaining: q,
              notes: notes ?? null,
            },
          });

          created.push(lot);
        }
      }

      return created;
    });
  }
}

module.exports = new ClothingStockLotService();
