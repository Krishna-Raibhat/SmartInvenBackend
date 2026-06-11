// src/services/storeStockLotService.js
import { prisma } from "../prisma/client.js";

class StoreStockLotService {
  async create({ owner_id, product_id, supplier_id, qty_in, cp, sp }) {
    const product = await prisma.storeProduct.findFirst({
      where: { product_id, owner_id },
      include: { category: true, unit: true },
    });

    if (!product) throw { code: "PRODUCT_NOT_FOUND", message: "Product not found." };
    if (product.type === "service") throw { code: "VALIDATION_ERROR", message: "Stock lot is not allowed for service." };

    if (!cp) throw { code: "REQUIRED_FIELDS", message: "cp is required." };
    if (!sp) throw { code: "REQUIRED_FIELDS", message: "sp is required." };
    if (!qty_in || qty_in <= 0) throw { code: "REQUIRED_FIELDS", message: "qty_in must be greater than 0." };

    if (supplier_id) {
      const supplier = await prisma.storeSupplier.findFirst({ where: { supplier_id, owner_id } });
      if (!supplier) throw { code: "SUPPLIER_NOT_FOUND", message: "Supplier not found." };
    }

    return prisma.storeStockLot.create({
      data: {
        owner_id,
        product_id,
        supplier_id: supplier_id || null,
        qty_in,
        qty_remaining: qty_in,
        cp,
        sp,
      },
      include: {
        product: { include: { category: true, unit: true } },
        supplier: true,
      },
    });
  }

  async list(owner_id) {
    return prisma.storeStockLot.findMany({
      where: { owner_id },
      orderBy: { created_at: "desc" },
      include: {
        product: { include: { category: true, unit: true } },
        supplier: true,
      },
    });
  }

  async getByProduct(owner_id, product_id) {
    const product = await prisma.storeProduct.findFirst({
      where: { product_id, owner_id },
    });

    if (!product) throw { code: "PRODUCT_NOT_FOUND", message: "Product not found." };
    if (product.type === "service") throw { code: "VALIDATION_ERROR", message: "Service does not have stock lots." };

    return prisma.storeStockLot.findMany({
      where: { product_id, owner_id },
      include: { supplier: true },
      orderBy: { created_at: "desc" },
    });
  }

  async getById(owner_id, lot_id) {
    const lot = await prisma.storeStockLot.findFirst({
      where: { lot_id, owner_id },
      include: {
        product: { include: { category: true, unit: true } },
        supplier: true,
      },
    });

    if (!lot) throw { code: "NOT_FOUND", message: "Stock lot not found." };
    return lot;
  }

  async update(owner_id, lot_id, { cp, sp, qty_in, qty_remaining }) {
    const existing = await prisma.storeStockLot.findFirst({
      where: { lot_id, owner_id },
      select: { lot_id: true, qty_in: true, qty_remaining: true },
    });

    if (!existing) throw { code: "NOT_FOUND", message: "Stock lot not found." };

    const currentQtyIn = Number(existing.qty_in);
    const currentQtyRemaining = Number(existing.qty_remaining);
    const qtySold = currentQtyIn - currentQtyRemaining;

    const newQtyIn = qty_in !== undefined ? Number(qty_in) : currentQtyIn;
    const newQtyRemaining = qty_remaining !== undefined ? Number(qty_remaining) : currentQtyRemaining;

    if (newQtyIn < qtySold) {
      throw { code: "VALIDATION_ERROR", message: `qty_in cannot be less than qty sold (${qtySold}).` };
    }
    if (newQtyRemaining > newQtyIn) {
      throw { code: "VALIDATION_ERROR", message: `qty_remaining cannot exceed qty_in (${newQtyIn}).` };
    }
    if (newQtyRemaining < 0) {
      throw { code: "VALIDATION_ERROR", message: "qty_remaining cannot be negative." };
    }

    const data = {};
    if (cp !== undefined) data.cp = cp;
    if (sp !== undefined) data.sp = sp;
    if (qty_in !== undefined) data.qty_in = newQtyIn;
    if (qty_remaining !== undefined) data.qty_remaining = newQtyRemaining;

    return prisma.storeStockLot.update({
      where: { lot_id },
      data,
      include: {
        product: { include: { category: true, unit: true } },
        supplier: true,
      },
    });
  }

  async delete(owner_id, lot_id) {
    const existing = await prisma.storeStockLot.findFirst({
      where: { lot_id, owner_id },
      select: { lot_id: true, qty_in: true, qty_remaining: true },
    });

    if (!existing) throw { code: "NOT_FOUND", message: "Stock lot not found." };

    const qtySold = Number(existing.qty_in) - Number(existing.qty_remaining);
    if (qtySold > 0) {
      throw {
        code: "IN_USE",
        message: `Cannot delete lot. ${qtySold} unit(s) already sold.`,
        details: { qty_sold: qtySold },
      };
    }

    await prisma.storeStockLot.delete({ where: { lot_id } });
    return { message: "Stock lot deleted successfully." };
  }
}

export default new StoreStockLotService();