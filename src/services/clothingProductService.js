// src/services/clothingProductService.js
const {prisma}  = require("../prisma/client");

class ClothingProductService {
  async create({ owner_id, category_id, product_name }) {
    try {
      return await prisma.clothingProduct.create({
        data: {
          owner_id,
          category_id,
          product_name,
        },
        include: {
          category: true,
        },
      });
    } catch (err) {
      // @@unique([owner_id, product_name])
      if (err.code === "P2002") {
        const targets = err.meta?.target || [];
        if (targets.includes("owner_id") && targets.includes("product_name")) {
          const e = new Error("Product name already exists for this owner.");
          e.status = 409;
          e.code = "PRODUCT_NAME_ALREADY_EXISTS";
          throw e;
        }
      }
      throw err;
    }
  }

  async list(owner_id) {
    return prisma.clothingProduct.findMany({
      where: { owner_id },
      orderBy: { created_at: "desc" },
      include: {
        category: true,
      },
    });
  }

  async getById(owner_id, product_id) {
    return prisma.clothingProduct.findFirst({
      where: { owner_id, product_id },
      include: {
        category: true,
      },
    });
  }

  async update(owner_id, product_id, { category_id, product_name }) {
    const existing = await prisma.clothingProduct.findFirst({
      where: { owner_id, product_id },
      select: { product_id: true },
    });
    if (!existing) return null;

    const data = {};
    if (category_id !== undefined) data.category_id = category_id;
    if (product_name !== undefined) data.product_name = product_name;

    try {
      return await prisma.clothingProduct.update({
        where: { product_id }, // product_id is global uuid
        data,
        include: { category: true },
      });
    } catch (err) {
      if (err.code === "P2002") {
        const targets = err.meta?.target || [];
        if (targets.includes("owner_id") && targets.includes("product_name")) {
          const e = new Error("Product name already exists for this owner.");
          e.status = 409;
          e.code = "PRODUCT_NAME_ALREADY_EXISTS";
          throw e;
        }
      }
      throw err;
    }
  }

  async remove(owner_id, product_id) {
    const existing = await prisma.clothingProduct.findFirst({
      where: { owner_id, product_id },
      select: { product_id: true },
    });
    if (!existing) return null;

    // block delete if linked stock lots or sales items exist
    const linkedLots = await prisma.clothingStockLot.count({ where: { product_id } });
    const linkedSales = await prisma.clothingSalesItem.count({ where: { product_id } });

    if (linkedLots > 0 || linkedSales > 0) return false;

    await prisma.clothingProduct.delete({ where: { product_id } });
    return true;
  }
}

module.exports = new ClothingProductService();
