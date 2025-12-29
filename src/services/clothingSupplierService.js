// src/services/clothingSupplierService.js
const prisma = require("../prisma/client");

class ClothingSupplierService {
  async create({ owner_id, supplier_name, phone, email, address }) {
    try {
      return await prisma.clothingSupplier.create({
        data: {
          owner_id,
          supplier_name,
          phone,
          email: email ?? null,
          address: address ?? null,
        },
      });
    } catch (err) {
      if (err.code === "P2002") {
        const targets = err.meta?.target || [];
        // @@unique([owner_id, phone])
        if (targets.includes("owner_id") && targets.includes("phone")) {
          const e = new Error("Supplier phone already in use.");
          e.status = 409;
          e.code = "SUPPLIER_PHONE_ALREADY_IN_USE";
          throw e;
        }
      }
      throw err;
    }
  }

  async list(owner_id) {
    return prisma.clothingSupplier.findMany({
      where: { owner_id },
      orderBy: { created_at: "desc" },
    });
  }

  async getById(owner_id, supplier_id) {
    return prisma.clothingSupplier.findFirst({
      where: { owner_id, supplier_id },
    });
  }

  async update(owner_id, supplier_id, data) {
    const existing = await prisma.clothingSupplier.findFirst({
      where: { owner_id, supplier_id },
      select: { supplier_id: true },
    });
    if (!existing) return null;

    const updateData = {};
    if ("supplier_name" in data) updateData.supplier_name = data.supplier_name;
    if ("phone" in data) updateData.phone = data.phone;
    if ("email" in data) updateData.email = data.email; // allow null
    if ("address" in data) updateData.address = data.address; // allow null

    try {
      return await prisma.clothingSupplier.update({
        where: { supplier_id },
        data: updateData,
      });
    } catch (err) {
      if (err.code === "P2002") {
        const targets = err.meta?.target || [];
        if (targets.includes("owner_id") && targets.includes("phone")) {
          const e = new Error("Supplier phone already in use.");
          e.status = 409;
          e.code = "SUPPLIER_PHONE_ALREADY_IN_USE";
          throw e;
        }
      }
      throw err;
    }
  }

  async remove(owner_id, supplier_id) {
    const supplier = await prisma.clothingSupplier.findFirst({
      where: { owner_id, supplier_id },
      select: { supplier_id: true },
    });
    if (!supplier) return null;

    // block delete if linked to any stock lots
    const linkedCount = await prisma.clothingStockLot.count({
      where: { supplier_id },
    });

    if (linkedCount > 0) return false;

    await prisma.clothingSupplier.delete({ where: { supplier_id } });
    return true;
  }
}

module.exports = new ClothingSupplierService();
