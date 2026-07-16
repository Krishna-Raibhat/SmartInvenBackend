// src/services/storeUnitService.js
import { prisma } from "../prisma/client.js";

class StoreUnitService {
  async create({ owner_id, unit_name }) {
    unit_name = String(unit_name).trim().toLowerCase();
    
    try {
      return await prisma.storeUnit.create({
        data: { owner_id, unit_name },
      });
    } catch (err) {
      if (err.code === "P2002") {
        throw { code: "DUPLICATE", message: "Unit already exists." };
      }
      throw err;
    }
  }

  async list(owner_id) {
    const units = await prisma.storeUnit.findMany({
      where: { owner_id },
      orderBy: { unit_name: "asc" },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    // reshape so the API returns product_count directly
    return units.map((u) => ({
      ...u,
      product_count: u._count.products,
      _count: undefined,
    }));
  }

  async getById(owner_id, unit_id) {
    const unit = await prisma.storeUnit.findFirst({
        where: { owner_id, unit_id },
    });

    if (!unit) throw { code: "NOT_FOUND", message: "Unit not found." };
    return unit;
    }

  async update(owner_id, unit_id, { unit_name }) {
    unit_name = String(unit_name).trim().toLowerCase();

    const existing = await prisma.storeUnit.findFirst({
      where: { owner_id, unit_id },
    });

    if (!existing) {
      throw { code: "NOT_FOUND", message: "Unit not found." };
    }

    try {
      return await prisma.storeUnit.update({
        where: { unit_id },
        data: { unit_name },
      });
    } catch (err) {
      if (err.code === "P2002") {
        throw { code: "DUPLICATE", message: "Unit already exists." };
      }
      throw err;
    }
  }

  async delete(owner_id, unit_id) {
    const existing = await prisma.storeUnit.findFirst({
        where: { owner_id, unit_id },
    });

    if (!existing) throw { code: "NOT_FOUND", message: "Unit not found." };

    const productCount = await prisma.storeProduct.count({
        where: { unit_id },
    });

    if (productCount > 0) {
        throw {
        code: "IN_USE",
        message: `Cannot delete unit "${existing.unit_name}". It has ${productCount} product(s) linked. Please reassign them first.`,
        details: { products: productCount },
        };
    }

    await prisma.storeUnit.delete({ where: { unit_id } });
    return { message: "Unit deleted successfully." };
    }
}

export default new StoreUnitService();
