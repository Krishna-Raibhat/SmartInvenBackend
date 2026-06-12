// src/services/storeCategoryService.js
import { prisma } from "../prisma/client.js";

class StoreCategoryService {
  async create({ owner_id, category_name }) {
    category_name = String(category_name).trim().toLowerCase();
    if (category_name === "general") {
    throw { code: "FORBIDDEN", message: "Cannot create a category named 'general'." };
    }
    try {
      return await prisma.storeCategory.create({
        data: { owner_id, category_name },
      });
    } catch (err) {
      if (err.code === "P2002") {
        throw { code: "DUPLICATE", message: "Category already exists." };
      }
      throw err;
    }
  }

  async list(owner_id) {
    const categories = await prisma.storeCategory.findMany({
      where: { owner_id },
      orderBy: { category_name: "asc" },
      include: {
        _count: { select: { products: true } },
      },
    });

    return categories.map(({ _count, ...cat }) => ({
      ...cat,
      product_count: _count.products,
    }));
  }

  async getById(owner_id, category_id) {
    return prisma.storeCategory.findFirst({
      where: { owner_id, category_id },
    });
  }

  async update(owner_id, category_id, { category_name }) {
    category_name = String(category_name).trim().toLowerCase();

    const existing = await prisma.storeCategory.findFirst({
      where: { owner_id, category_id },
    });

    if (!existing) {
      throw { code: "NOT_FOUND", message: "Category not found." };
    }

    if (existing.category_name === "general") {
      throw { code: "FORBIDDEN", message: "Cannot modify the default category." };
    }

    try {
      return await prisma.storeCategory.update({
        where: { category_id },
        data: { category_name },
      });
    } catch (err) {
      if (err.code === "P2002") {
        throw { code: "DUPLICATE", message: "Category already exists." };
      }
      throw err;
    }
  }

  async delete(owner_id, category_id) {
    const existing = await prisma.storeCategory.findFirst({
        where: { owner_id, category_id },
    });

    if (!existing) throw { code: "NOT_FOUND", message: "Category not found." };

    if (existing.category_name === "general") {
        throw { code: "FORBIDDEN", message: "Cannot delete the default category." };
    }

    const productCount = await prisma.storeProduct.count({
        where: { category_id },
    });

    if (productCount > 0) {
        throw {
        code: "IN_USE",
        message: `Cannot delete category "${existing.category_name}". It has ${productCount} product(s) linked. Please reassign them first.`,
        details: { products: productCount },
        };
    }

    await prisma.storeCategory.delete({ where: { category_id } });
    return { message: "Category deleted successfully." };
    }
}

export default new StoreCategoryService();
