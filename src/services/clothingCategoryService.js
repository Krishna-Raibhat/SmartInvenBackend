// src/services/clothingCategoryService.js
const {prisma} = require("../prisma/client");

class ClothingCategoryService {
  async create({ category_name }) {
    try {
      return await prisma.clothingCategory.create({
        data: { category_name },
      });
    } catch (err) {
      if (err.code === "P2002") {
        const e = new Error("Category name already exists.");
        e.status = 409;
        e.code = "CATEGORY_ALREADY_EXISTS";
        throw e;
      }
      throw err;
    }
  }

  async list() {
    return prisma.clothingCategory.findMany({
      orderBy: { created_at: "desc" },
    });
  }

  async getById(category_id) {
    return prisma.clothingCategory.findUnique({
      where: { category_id },
    });
  }

  async update(category_id, { category_name }) {
    const existing = await prisma.clothingCategory.findUnique({
      where: { category_id },
      select: { category_id: true },
    });
    if (!existing) return null;

    try {
      return await prisma.clothingCategory.update({
        where: { category_id },
        data: { category_name },
      });
    } catch (err) {
      if (err.code === "P2002") {
        const e = new Error("Category name already exists.");
        e.status = 409;
        e.code = "CATEGORY_ALREADY_EXISTS";
        throw e;
      }
      throw err;
    }
  }

  async remove(category_id) {
    const existing = await prisma.clothingCategory.findUnique({
      where: { category_id },
      select: { category_id: true },
    });
    if (!existing) return null;

    // block delete if linked products exist
    const linked = await prisma.clothingProduct.count({
      where: { category_id },
    });
    if (linked > 0) return false;

    await prisma.clothingCategory.delete({ where: { category_id } });
    return true;
  }
}

module.exports = new ClothingCategoryService();
