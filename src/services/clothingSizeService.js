// src/services/clothingSizeService.js
const {prisma}  = require("../prisma/client");

class ClothingSizeService {
  async create({ size_name }) {
    size_name = String(color_name).trim().toLowerCase();
    try {
      return await prisma.clothingSize.create({
        data: { size_name },
      });
    } catch (err) {
      if (err.code === "P2002") {
        const e = new Error("Size name already exists.");
        e.status = 409;
        e.code = "SIZE_ALREADY_EXISTS";
        throw e;
      }
      throw err;
    }
  }

  async list() {
    return prisma.clothingSize.findMany({
      orderBy: { size_name: "asc" },
    });
  }

  async getById(size_id) {
    return prisma.clothingSize.findUnique({
      where: { size_id },
    });
  }

  async update(size_id, { size_name }) {
    size_name = String(color_name).trim().toLowerCase();
    const existing = await prisma.clothingSize.findUnique({
      where: { size_id },
      select: { size_id: true },
    });
    if (!existing) return null;

    try {
      return await prisma.clothingSize.update({
        where: { size_id },
        data: { size_name },
      });
    } catch (err) {
      if (err.code === "P2002") {
        const e = new Error("Size name already exists.");
        e.status = 409;
        e.code = "SIZE_ALREADY_EXISTS";
        throw e;
      }
      throw err;
    }
  }

  async remove(size_id) {
    const existing = await prisma.clothingSize.findUnique({
      where: { size_id },
      select: { size_id: true },
    });
    if (!existing) return null;

    // Block delete if linked stock lots or sales items exist
    const linkedLots = await prisma.clothingStockLot.count({ where: { size_id } });
    const linkedSales = await prisma.clothingSalesItem.count({ where: { size_id } });

    if (linkedLots > 0 || linkedSales > 0) return false;

    await prisma.clothingSize.delete({ where: { size_id } });
    return true;
  }
}

module.exports = new ClothingSizeService();
