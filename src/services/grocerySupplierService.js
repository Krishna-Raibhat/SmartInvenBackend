// src/services/grocerySupplierService.js
import prisma from "../config/prisma.js";

class GrocerySupplierService {
  async create({ owner_id, supplier_name, phone, email, address }) {
    try {
      return await prisma.grocerySupplier.create({
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
        const e = new Error("Supplier phone already in use.");
        e.status = 409;
        e.code = "SUPPLIER_PHONE_ALREADY_IN_USE";
        throw e;
      }

      throw err;
    }
  }

  async list(owner_id) {
    return prisma.grocerySupplier.findMany({
      where: { owner_id },
      orderBy: { created_at: "desc" },
    });
  }

  async getById(owner_id, supplier_id) {
    const supplier = await prisma.grocerySupplier.findFirst({
      where: { owner_id, supplier_id },
    });

    if (!supplier) {
      return null;
    }

    // Get stock lot statistics for this supplier
    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(lot_id)::int AS total_stock_lots,
        COALESCE(SUM(qty_in), 0)::numeric AS total_qty_purchased,
        COALESCE(SUM(qty_remaining), 0)::numeric AS total_qty_remaining,
        COALESCE(SUM(cp * qty_in), 0)::numeric AS total_purchase_amount
      FROM grocery_stock_lots
      WHERE supplier_id = ${supplier_id}
        AND owner_id = ${owner_id}
    `;

    const stockStats = stats[0] || {};

    return {
      ...supplier,
      stock_statistics: {
        total_stock_lots: Number(stockStats.total_stock_lots || 0),
        total_qty_purchased: Number(stockStats.total_qty_purchased || 0),
        total_qty_remaining: Number(stockStats.total_qty_remaining || 0),
        total_purchase_amount: Number(stockStats.total_purchase_amount || 0),
      },
    };
  }

  async update(owner_id, supplier_id, data) {
    const existing = await prisma.grocerySupplier.findFirst({
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
      return await prisma.grocerySupplier.update({
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
    const supplier = await prisma.grocerySupplier.findFirst({
      where: { owner_id, supplier_id },
      select: { supplier_id: true },
    });
    if (!supplier) return null;

    // Note: Add check for linked stock lots when GroceryStockLot model is created
    // const linkedCount = await prisma.groceryStockLot.count({
    //   where: { supplier_id },
    // });
    // if (linkedCount > 0) return false;

    await prisma.grocerySupplier.delete({ where: { supplier_id } });
    return true;
  }
}

export default new GrocerySupplierService();
