// src/services/clothingColorService.js
const {prisma}  = require("../prisma/client");

class ClothingColorService {
  async create({ color_name }) {
    try {
      return await prisma.clothingColor.create({
        data: { color_name },
      });
    } catch (err) {
      if (err.code === "P2002") {
        const e = new Error("Color name already exists.");
        e.status = 409;
        e.code = "COLOR_ALREADY_EXISTS";
        throw e;
      }
      throw err;
    }
  }

  async list() {
    return prisma.clothingColor.findMany({
      orderBy: { color_name: "asc" },
    });
  }

  async getById(color_id) {
    return prisma.clothingColor.findUnique({
      where: { color_id },
    });
  }

  async update(color_id, { color_name }) {
    const existing = await prisma.clothingColor.findUnique({
      where: { color_id },
      select: { color_id: true },
    });
    if (!existing) return null;

    try {
      return await prisma.clothingColor.update({
        where: { color_id },
        data: { color_name },
      });
    } catch (err) {
      if (err.code === "P2002") {
        const e = new Error("Color name already exists.");
        e.status = 409;
        e.code = "COLOR_ALREADY_EXISTS";
        throw e;
      }
      throw err;
    }
  }

  async remove(color_id) {
    const existing = await prisma.clothingColor.findUnique({
      where: { color_id },
      select: { color_id: true },
    });
    if (!existing) return null;

    // Block delete if linked stock lots or sales items exist
    const linkedLots = await prisma.clothingStockLot.count({ where: { color_id } });
    const linkedSales = await prisma.clothingSalesItem.count({ where: { color_id } });

    if (linkedLots > 0 || linkedSales > 0) return false;

    await prisma.clothingColor.delete({ where: { color_id } });
    return true;
  }
}

module.exports = new ClothingColorService();
