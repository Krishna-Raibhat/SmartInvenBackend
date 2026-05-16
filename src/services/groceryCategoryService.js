// src/services/groceryCategoryService.js
import { prisma } from "../prisma/client.js";

class GroceryCategoryService {

  async create({ category_name }) {
    category_name = String(category_name).trim().toLowerCase();
    try {
      return await prisma.groceryCategory.create({
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
    return prisma.groceryCategory.findMany({
      orderBy: { created_at: "desc" },
    });
  }

  async getById(category_id) {
    return prisma.groceryCategory.findUnique({
      where: { category_id },
    });
  }

  async update(category_id, { category_name }) {
    category_name = String(category_name).trim().toLowerCase();
    const existing = await prisma.groceryCategory.findUnique({
      where: { category_id },
      select: { category_id: true },
    });
    if (!existing) return null;

    try {
      return await prisma.groceryCategory.update({
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
    const existing = await prisma.groceryCategory.findUnique({
      where: { category_id },
      select: { category_id: true },
    });
    if (!existing) return null;

    // Check for linked products
    const linked = await prisma.groceryProduct.count({
      where: { category_id },
    });
    if (linked > 0) return false;

    await prisma.groceryCategory.delete({ where: { category_id } });
    return true;
  }
}

export default new GroceryCategoryService();
