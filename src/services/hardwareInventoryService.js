// src/services/hardwareInventoryService.js
const prisma = require("../prisma/client");

class HardwareInventoryService {
  async listInventory(owner_id) {
    const products = await prisma.hardwareProduct.findMany({
      where: { owner_id },
      orderBy: { product_name: "asc" },
      include: { category: { select: { category_name: true } } },
    });

    if (products.length === 0) return [];

    const productIds = products.map(p => p.product_id);

    const lots = await prisma.hardwareStockLot.groupBy({
      by: ["product_id"],
      where: { owner_id, product_id: { in: productIds } },
      _sum: { qty_remaining: true },
    });

    const stockMap = new Map(lots.map(x => [x.product_id, Number(x._sum.qty_remaining || 0)]));

    return products.map(p => ({
      product_id: p.product_id,
      product_name: p.product_name,
      category_id: p.category_id,
      category_name: p.category?.category_name ?? null,
      total_stock: stockMap.get(p.product_id) || 0,
      created_at: p.created_at,
    }));
  }

  async getInventoryDetail(owner_id, product_id, supplier_id = null) {
    const product = await prisma.hardwareProduct.findFirst({
      where: { owner_id, product_id },
      include: { category: { select: { category_id: true, category_name: true } } },
    });
    if (!product) return null;

    const totalAgg = await prisma.hardwareStockLot.aggregate({
      where: { owner_id, product_id },
      _sum: { qty_remaining: true },
    });
    const total_stock = Number(totalAgg._sum.qty_remaining || 0);

    // supplier dropdown options (suppliers who have lots for this product)
    const supplierAgg = await prisma.hardwareStockLot.groupBy({
      by: ["supplier_id"],
      where: { owner_id, product_id },
      _sum: { qty_remaining: true },
    });

    const supplierIds = supplierAgg.map(x => x.supplier_id);

    const suppliers = await prisma.hardwareSupplier.findMany({
      where: { owner_id, supplier_id: { in: supplierIds } },
      select: { supplier_id: true, supplier_name: true },
    });

    const supNameMap = new Map(suppliers.map(s => [s.supplier_id, s.supplier_name]));

    const supplier_options = supplierAgg.map(x => ({
      supplier_id: x.supplier_id,
      supplier_name: supNameMap.get(x.supplier_id) || "Unknown Supplier",
      qty_remaining: Number(x._sum.qty_remaining || 0),
    }));

    // lots list
    const lotWhere = { owner_id, product_id };
    if (supplier_id) {
      // validate supplier belongs to owner
      const sup = await prisma.hardwareSupplier.findFirst({
        where: { owner_id, supplier_id },
        select: { supplier_id: true },
      });
      if (!sup) {
        const err = new Error("Selected supplier not found");
        err.status = 404; err.code = "SUPPLIER_NOT_FOUND";
        throw err;
      }
      lotWhere.supplier_id = supplier_id;
    }

    const lots = await prisma.hardwareStockLot.findMany({
      where: lotWhere,
      orderBy: { created_at: "desc" },
      select: {
        lot_id: true, supplier_id: true, cp: true, sp: true,
        qty_in: true, qty_remaining: true, notes: true, created_at: true,
      },
    });

    const lotIds = lots.map(l => l.lot_id);

    // sold qty per lot
    const soldAgg = lotIds.length
      ? await prisma.hardwareStockOutItem.groupBy({
          by: ["lot_id"],
          where: { owner_id, lot_id: { in: lotIds } },
          _sum: { qty: true },
        })
      : [];

    const soldMap = new Map(soldAgg.map(r => [r.lot_id, Number(r._sum.qty || 0)]));

    const lots_view = lots.map(l => ({
      lot_id: l.lot_id,
      supplier_id: l.supplier_id,
      supplier_name: supNameMap.get(l.supplier_id) || "Unknown Supplier",
      cp: Number(l.cp),
      sp: Number(l.sp),
      qty_in: l.qty_in,
      qty_sold: soldMap.get(l.lot_id) || (l.qty_in - l.qty_remaining),
      qty_remaining: l.qty_remaining,
      notes: l.notes,
      stockin_created_at: l.created_at,
    }));

    return {
      product: {
        product_id: product.product_id,
        product_name: product.product_name,
        category_id: product.category_id,
        category_name: product.category?.category_name ?? null,
        created_at: product.created_at,
        total_stock,
      },
      supplier_options,
      lots: lots_view,
    };
  }

  async updateProduct(owner_id, product_id, data) {
    const existing = await prisma.hardwareProduct.findFirst({
      where: { owner_id, product_id },
      select: { product_id: true },
    });
    if (!existing) return null;

    const updateData = {};
    if (data.product_name !== undefined) updateData.product_name = String(data.product_name || "").trim();
    if (data.category_id !== undefined) updateData.category_id = data.category_id;

    try {
      return await prisma.hardwareProduct.update({
        where: { product_id },
        data: updateData,
      });
    } catch (e) {
      if (e.code === "P2002") {
        const err = new Error("Product already exists for this owner.");
        err.status = 409; err.code = "PRODUCT_ALREADY_EXISTS";
        throw err;
      }
      throw e;
    }
  }

  async updateLot(owner_id, lot_id, data) {
    const lot = await prisma.hardwareStockLot.findFirst({
      where: { owner_id, lot_id },
    });
    if (!lot) return null;

    if (data.supplier_id !== undefined) {
      const sup = await prisma.hardwareSupplier.findFirst({
        where: { owner_id, supplier_id: data.supplier_id },
        select: { supplier_id: true },
      });
      if (!sup) {
        const err = new Error("Selected supplier not found");
        err.status = 404; err.code = "SUPPLIER_NOT_FOUND";
        throw err;
      }
    }

    // qty_in safety: cannot go below sold qty
    let qty_in = undefined;
    let qty_remaining = undefined;
    if (data.qty_in !== undefined) {
      const newQtyIn = Number(data.qty_in);
      if (!Number.isInteger(newQtyIn) || newQtyIn <= 0) {
        const err = new Error("qty_in must be a positive integer");
        err.status = 400; err.code = "VALIDATION_QTY_INVALID";
        throw err;
      }
      const soldQty = lot.qty_in - lot.qty_remaining;
      if (newQtyIn < soldQty) {
        const err = new Error(`qty_in cannot be less than qty already sold (${soldQty})`);
        err.status = 400; err.code = "VALIDATION_QTY_IN_TOO_SMALL";
        throw err;
      }
      qty_in = newQtyIn;
      qty_remaining = newQtyIn - soldQty;
    }

    return prisma.hardwareStockLot.update({
      where: { lot_id },
      data: {
        supplier_id: data.supplier_id ?? undefined,
        cp: data.cp ?? undefined,
        sp: data.sp ?? undefined,
        notes: data.notes ?? undefined,
        qty_in,
        qty_remaining,
      },
    });
  }

  async listLowStock(owner_id, threshold) {
    const t = Number(threshold);
    if (!Number.isFinite(t) || t < 0) {
      const err = new Error("threshold must be a number >= 0");
      err.status = 400; err.code = "VALIDATION_THRESHOLD_INVALID";
      throw err;
    }

    const products = await this.listInventory(owner_id);
    return products.filter(p => p.total_stock < t);
  }

  async deleteProduct(owner_id, product_id) {
    const product = await prisma.hardwareProduct.findFirst({
      where: { owner_id, product_id },
      select: { product_id: true },
    });
    if (!product) return null;

    const lotCount = await prisma.hardwareStockLot.count({
      where: { owner_id, product_id },
    });
    if (lotCount > 0) return false;

    const saleCount = await prisma.hardwareStockOutItem.count({
      where: { owner_id, product_id },
    });
    if (saleCount > 0) return false;

    await prisma.hardwareProduct.delete({ where: { product_id } });
    return true;
  }

}

module.exports = new HardwareInventoryService();
