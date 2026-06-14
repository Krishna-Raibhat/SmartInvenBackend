// src/services/storeProductService.js
import { prisma } from "../prisma/client.js";

class StoreProductService {
  async create({ owner_id, category_id, unit_id, product_name, type = "item", description, cp, sp }) {
    product_name = String(product_name).trim();

    if (type === "item" && !unit_id) {
      throw { code: "REQUIRED_FIELDS", message: "unit_id is required for item." };
    }

    if (type === "service" && !sp) {
      throw { code: "REQUIRED_FIELDS", message: "sp is required for service." };
    }

    if (unit_id) {
      const unit = await prisma.storeUnit.findFirst({ where: { unit_id, owner_id } });
      if (!unit) throw { code: "UNIT_NOT_FOUND", message: "Unit not found." };
    }

    if (category_id) {
      const category = await prisma.storeCategory.findFirst({ where: { category_id, owner_id } });
      if (!category) throw { code: "CATEGORY_NOT_FOUND", message: "Category not found." };
    }

    try {
      return await prisma.storeProduct.create({
        data: {
          owner_id,
          category_id: category_id || null,
          unit_id: unit_id || null,
          product_name,
          type,
          description: description?.trim() || null,
          cp: cp ?? null,
          sp: sp ?? null,
        },
        include: { category: true, unit: true },
      });
    } catch (err) {
      if (err.code === "P2002") throw { code: "DUPLICATE", message: "Product name already exists." };
      throw err;
    }
  }

  async list(owner_id) {
    return prisma.storeProduct.findMany({
      where: { owner_id },
      orderBy: { created_at: "desc" },
      include: { category: true, unit: true },
    });
  }

  async getById(owner_id, product_id) {
    const product = await prisma.storeProduct.findFirst({
      where: { owner_id, product_id },
      include: {
        category: true,
        unit: true,
        stockLots: {
          include: { supplier: true },
          orderBy: { created_at: "desc" },
        },
      },
    });

    if (!product) throw { code: "NOT_FOUND", message: "Product not found." };
    return product;
  }

  async update(owner_id, product_id, { category_id, unit_id, product_name, type, description, cp, sp }) {
    const existing = await prisma.storeProduct.findFirst({
      where: { owner_id, product_id },
    });

    if (!existing) throw { code: "NOT_FOUND", message: "Product not found." };

    const resolvedType = type ?? existing.type;

    if (resolvedType === "item") {
      const resolvedUnit = unit_id ?? existing.unit_id;
      if (!resolvedUnit) throw { code: "REQUIRED_FIELDS", message: "unit_id is required for item." };
    }

    if (resolvedType === "service") {
      const resolvedSp = sp ?? existing.sp;
      if (!resolvedSp) throw { code: "REQUIRED_FIELDS", message: "sp is required for service." };
    }

    if (unit_id) {
      const unit = await prisma.storeUnit.findFirst({ where: { unit_id, owner_id } });
      if (!unit) throw { code: "UNIT_NOT_FOUND", message: "Unit not found." };
    }

    if (category_id) {
      const category = await prisma.storeCategory.findFirst({ where: { category_id, owner_id } });
      if (!category) throw { code: "CATEGORY_NOT_FOUND", message: "Category not found." };
    }

    const data = {};
    if (product_name !== undefined) data.product_name = String(product_name).trim();
    if (type !== undefined) data.type = type;
    if (description !== undefined) data.description = description?.trim() || null;
    if (category_id !== undefined) data.category_id = category_id || null;
    if (unit_id !== undefined) data.unit_id = unit_id || null;
    if (cp !== undefined) data.cp = cp ?? null;
    if (sp !== undefined) data.sp = sp ?? null;

    try {
      return await prisma.storeProduct.update({
        where: { product_id },
        data,
        include: { category: true, unit: true },
      });
    } catch (err) {
      if (err.code === "P2002") throw { code: "DUPLICATE", message: "Product name already exists." };
      throw err;
    }
  }

  async delete(owner_id, product_id) {
    const existing = await prisma.storeProduct.findFirst({
      where: { owner_id, product_id },
    });

    if (!existing) throw { code: "NOT_FOUND", message: "Product not found." };

    const linkedLots = await prisma.storeStockLot.count({ where: { product_id } });

    if (linkedLots > 0) {
      throw {
        code: "IN_USE",
        message: `Cannot delete "${existing.product_name}". It has ${linkedLots} stock lot(s) linked.`,
        details: { stock_lots: linkedLots },
      };
    }

    await prisma.storeProduct.delete({ where: { product_id } });
    return { message: "Product deleted successfully." };
  }
}

export default new StoreProductService();