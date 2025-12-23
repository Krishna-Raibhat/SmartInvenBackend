// src/services/hardwareCategoryService.js
const prisma = require("../prisma/client");

class HardwareCategoryService {
  async createCategory({ package_id, category_name}) {
    const name = String(category_name || "").trim();
    if (!name) {
      const err = new Error("category_name is required");
      err.status = 400;
      err.code = "VALIDATION_REQUIRED_FIELDS";
      throw err;
    }

    try {
      return await prisma.hardwareCategory.create({
        data: {
          package_id,
          category_name: name
          
        },
      });
    } catch (e) {
      if (e.code === "P2002") {
        const err = new Error("Category already exists in this package.");
        err.status = 409;
        err.code = "CATEGORY_ALREADY_EXISTS";
        throw err;
      }
      throw e;
    }
  }

  async listCategories(package_id) {
    return await prisma.hardwareCategory.findMany({
      where: { package_id },
      orderBy: { category_name: "asc" },
    });
  }

  async getById(category_id, package_id) {
    return await prisma.hardwareCategory.findFirst({
      where: { category_id, package_id },
    });
  }

  async updateCategory(category_id, package_id, { category_name }) {
    const category = await this.getById(category_id, package_id);
    if (!category) return null;

    const name = String(category_name || "").trim();
    if (!name) {
      const err = new Error("category_name cannot be empty");
      err.status = 400;
      err.code = "VALIDATION_CATEGORY_NAME_EMPTY";
      throw err;
    }

    try {
      return await prisma.hardwareCategory.update({
        where: { category_id },
        data: { category_name: name },
      });
    } catch (e) {
      if (e.code === "P2002") {
        const err = new Error("Category already exists in this package.");
        err.status = 409;
        err.code = "CATEGORY_ALREADY_EXISTS";
        throw err;
      }
      throw e;
    }
  }

  // ✅ return:
  // null => not found
  // false => blocked (linked products exist)
  // true => deleted
  async deleteCategory(category_id, package_id) {
    const category = await this.getById(category_id, package_id);
    if (!category) return null;

    // block delete if linked with products (products are owner-based but category is shared)
    const linkedCount = await prisma.hardwareProduct.count({
      where: { category_id },
    });

    if (linkedCount > 0) return false;

    await prisma.hardwareCategory.delete({ where: { category_id } });
    return true;
  }
}

module.exports = new HardwareCategoryService();
