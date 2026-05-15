// src/services/groceryBrandService.js
import { prisma } from "../prisma/client.js";

class GroceryBrandService {

  async create({ brand_name }) {
    brand_name = String(brand_name).trim().toLowerCase();
    try {
      return await prisma.groceryBrand.create({
        data: { brand_name },
      });
    } catch (err) {
      if (err.code === "P2002") {
        const e = new Error("Brand name already exists.");
        e.status = 409;
        e.code = "BRAND_ALREADY_EXISTS";
        throw e;
      }
      throw err;
    }
  }

  async list() {
    return prisma.groceryBrand.findMany({
      orderBy: { created_at: "desc" },
    });
  }

  async getById(brand_id) {
    return prisma.groceryBrand.findUnique({
      where: { brand_id },
    });
  }

  async update(brand_id, { brand_name }) {
    brand_name = String(brand_name).trim().toLowerCase();
    const existing = await prisma.groceryBrand.findUnique({
      where: { brand_id },
      select: { brand_id: true },
    });
    if (!existing) return null;

    try {
      return await prisma.groceryBrand.update({
        where: { brand_id },
        data: { brand_name },
      });
    } catch (err) {
      if (err.code === "P2002") {
        const e = new Error("Brand name already exists.");
        e.status = 409;
        e.code = "BRAND_ALREADY_EXISTS";
        throw e;
      }
      throw err;
    }
  }

  async remove(brand_id) {
    const existing = await prisma.groceryBrand.findUnique({
      where: { brand_id },
      select: { brand_id: true },
    });
    if (!existing) return null;

    // Note: Add check for linked products when GroceryProduct model is created
    // const linked = await prisma.groceryProduct.count({
    //   where: { brand_id },
    // });
    // if (linked > 0) return false;

    await prisma.groceryBrand.delete({ where: { brand_id } });
    return true;
  }
}

export default new GroceryBrandService();
