// src/services/storeSupplierService.js
import { prisma } from "../prisma/client.js";

class StoreSupplierService {
  async create({ owner_id, supplier_name, phone, email, address }) {
    try {
      return await prisma.storeSupplier.create({
        data: {
          owner_id,
          supplier_name: supplier_name.trim(),
          phone: phone.trim(),
          email: email?.trim() || null,
          address: address?.trim() || null,
        },
      });
    } catch (err) {
      if (err.code === "P2002") {
        throw { code: "DUPLICATE", message: "Supplier with this phone already exists." };
      }
      throw err;
    }
  }

  async list(owner_id) {
    return prisma.storeSupplier.findMany({
      where: { owner_id },
      orderBy: { created_at: "desc" },
    });
  }

  async getById(owner_id, supplier_id) {
    const supplier = await prisma.storeSupplier.findFirst({
      where: { owner_id, supplier_id },
    });

    if (!supplier) {
      throw { code: "NOT_FOUND", message: "Supplier not found." };
    }

    return supplier;
  }

  async update(owner_id, supplier_id, data) {
    const existing = await prisma.storeSupplier.findFirst({
      where: { owner_id, supplier_id },
      select: { supplier_id: true },
    });

    if (!existing) {
      throw { code: "NOT_FOUND", message: "Supplier not found." };
    }

    const updateData = {};
    if (data.supplier_name) updateData.supplier_name = data.supplier_name.trim();
    if (data.phone) updateData.phone = data.phone.trim();
    if (data.email !== undefined) updateData.email = data.email?.trim() || null;
    if (data.address !== undefined) updateData.address = data.address?.trim() || null;

    try {
      return await prisma.storeSupplier.update({
        where: { supplier_id },
        data: updateData,
      });
    } catch (err) {
      if (err.code === "P2002") {
        throw { code: "DUPLICATE", message: "Supplier with this phone already exists." };
      }
      throw err;
    }
  }

  async remove(owner_id, supplier_id) {
    const supplier = await prisma.storeSupplier.findFirst({
      where: { owner_id, supplier_id },
      select: { supplier_id: true, supplier_name: true },
    });

    if (!supplier) {
      throw { code: "NOT_FOUND", message: "Supplier not found." };
    }

    // Check if supplier has linked stock lots
    const stockLotCount = await prisma.storeStockLot.count({
      where: { supplier_id },
    });

    if (stockLotCount > 0) {
      throw {
        code: "IN_USE",
        message: `Cannot delete supplier "${supplier.supplier_name}". It has ${stockLotCount} stock lot(s) linked. Please reassign or remove them first.`,
        details: { stockLots: stockLotCount },
      };
    }

    await prisma.storeSupplier.delete({ where: { supplier_id } });
    return true;
  }
}

export default new StoreSupplierService();
