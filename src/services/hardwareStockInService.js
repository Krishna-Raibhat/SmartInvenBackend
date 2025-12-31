const {prisma}  = require("../prisma/client");

class HardwareStockInService {
  async stockIn({ owner_id, product_id, supplier_id, cp, sp, qty, notes}) {
    if (!product_id || !supplier_id) {
      const err = new Error("product_id and supplier_id are required");
      err.status = 400;
      err.code = "VALIDATION_REQUIRED_FIELDS";
      throw err;
    }

    const q = Number(qty);
    if (!Number.isInteger(q) || q <= 0) {
      const err = new Error("qty must be a positive integer");
      err.status = 400;
      err.code = "VALIDATION_QTY_INVALID";
      throw err;
    }

    const cpNum = Number(cp);
    const spNum = Number(sp);

    if (!Number.isFinite(cpNum) || cpNum <= 0) {
      const err = new Error("cp must be a positive number");
      err.status = 400;
      err.code = "VALIDATION_CP_INVALID";
      throw err;
    }

    if (!Number.isFinite(spNum) || spNum <= 0) {
      const err = new Error("sp must be a positive number");
      err.status = 400;
      err.code = "VALIDATION_SP_INVALID";
      throw err;
    }

    // ✅ Ensure product belongs to this owner
    const product = await prisma.hardwareProduct.findFirst({
      where: { product_id, owner_id },
      select: { product_id: true },
    });
    if (!product) return null;

    // ✅ Ensure supplier belongs to this owner
    const supplier = await prisma.hardwareSupplier.findFirst({
      where: { supplier_id, owner_id },
      select: { supplier_id: true },
    });
    if (!supplier) {
      const err = new Error("Supplier not found for this owner");
      err.status = 404;
      err.code = "SUPPLIER_NOT_FOUND";
      throw err;
    }

    // ✅ Create stock lot
    return prisma.hardwareStockLot.create({
      data: {
        owner_id,              // ✅ you should store owner_id in lot
        product_id,
        supplier_id,
        cp: String(cp),
        sp: String(sp),
        qty_in: q,
        qty_remaining: q,
        notes: notes ?? null,
        
      },
    });
  }
}

module.exports = new HardwareStockInService();
