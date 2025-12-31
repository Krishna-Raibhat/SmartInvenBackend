// src/services/hardwareSupplierService.js
const {prisma}  = require("../prisma/client");

class HardwareSupplierService {
  async createSupplier({ owner_id, supplier_name, phone, email, address }) {
    try {
      return await prisma.hardwareSupplier.create({
        data: {
          owner_id,
          supplier_name,
          phone,
          email: email ?? null,
          address: address ?? null,
        },
      });
    } catch (err) {
      // ✅ Prisma unique constraint error
      if (err?.code === "P2002") {
        const target = err?.meta?.target;

        const targetText = Array.isArray(target) ? target.join(",") : String(target || "");

        // ✅ detect composite unique (owner_id + phone)
        if (targetText.includes("owner_id") && targetText.includes("phone")) {
          const e = new Error("Supplier phone already in use.");
          e.status = 409;
          e.code = "SUPPLIER_PHONE_ALREADY_IN_USE";
          throw e;
        }

        // ✅ fallback (still return friendly)
        const e = new Error(" This supplier might already exist.");
        e.status = 409;
        e.code = "DUPLICATE_VALUE";
        throw e;
      }

      throw err;
    }
  }

  async getAllSuppliers(owner_id) {
    return await prisma.hardwareSupplier.findMany({
      where: { owner_id },
      orderBy: { created_at: "desc" },
    });
  }

  async getSupplierById(supplier_id, owner_id) {
    return await prisma.hardwareSupplier.findFirst({
      where: { supplier_id, owner_id },
    });
  }

  async updateSupplier(supplier_id, owner_id, data) {
    const existing = await prisma.hardwareSupplier.findFirst({
      where: { supplier_id, owner_id },
      select: { supplier_id: true },
    });
    if (!existing) return null;

    // ✅ allow clearing fields with null (email/address)
    const updateData = {};
    if ("supplier_name" in data) updateData.supplier_name = data.supplier_name;
    if ("phone" in data) updateData.phone = data.phone;
    if ("email" in data) updateData.email = data.email;       // can be null
    if ("address" in data) updateData.address = data.address; // can be null

    try {
      return await prisma.hardwareSupplier.update({
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

  async deleteSupplier(supplier_id, owner_id) {
    const supplier = await prisma.hardwareSupplier.findFirst({
      where: { supplier_id, owner_id },
      select: { supplier_id: true },
    });
    if (!supplier) return null;

    const linkedCount = await prisma.hardwareStockLot.count({
      where: { supplier_id }, // supplier_id is UUID, globally unique -> OK
    });

    if (linkedCount > 0) return false;

    await prisma.hardwareSupplier.delete({
      where: { supplier_id },
    });

    return true;
  }
}

module.exports = new HardwareSupplierService();
