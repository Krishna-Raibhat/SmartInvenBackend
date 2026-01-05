// src/services/clothingSupplierReturnService.js
const { prisma } = require("../prisma/client");

const allowedStatus = new Set(["pending", "approved", "completed", "cancelled"]);

class ClothingSupplierReturnService {

  // ======================================================
  // CREATE RETURN (NO STOCK CHANGE HERE)
  // ======================================================
  async createReturn(owner_id, payload) {
    const { supplier_id, note, items } = payload;

    if (!supplier_id) {
      const e = new Error("supplier_id is required");
      e.status = 400;
      e.code = "VALIDATION_SUPPLIER_REQUIRED";
      throw e;
    }

    if (!Array.isArray(items) || items.length === 0) {
      const e = new Error("At least one return item is required");
      e.status = 400;
      e.code = "VALIDATION_NO_ITEMS";
      throw e;
    }

    const supplier = await prisma.clothingSupplier.findFirst({
      where: { supplier_id, owner_id },
      select: { supplier_id: true },
    });
    if (!supplier) {
      const e = new Error("Supplier not found for this owner");
      e.status = 404;
      e.code = "SUPPLIER_NOT_FOUND";
      throw e;
    }

    return prisma.$transaction(async (tx) => {
      const header = await tx.clothingSupplierReturn.create({
        data: {
          owner_id,
          supplier_id,
          status: "pending",
          note: note ?? null,
        },
      });

      for (const it of items) {
        const lot_id = String(it.lot_id || "").trim();
        const qty = Number(it.qty);

        if (!lot_id) {
          const e = new Error("lot_id is required");
          e.status = 400;
          e.code = "VALIDATION_LOT_REQUIRED";
          throw e;
        }

        if (!Number.isInteger(qty) || qty <= 0) {
          const e = new Error("qty must be a positive integer");
          e.status = 400;
          e.code = "VALIDATION_QTY_INVALID";
          throw e;
        }

        // owner-safe lot check
        const lot = await tx.clothingStockLot.findFirst({
          where: { lot_id, product: { owner_id } },
          select: { lot_id: true },
        });

        if (!lot) {
          const e = new Error("Stock lot not found");
          e.status = 404;
          e.code = "LOT_NOT_FOUND";
          throw e;
        }

        await tx.clothingSupplierReturnItem.create({
          data: {
            return_id: header.return_id,
            lot_id,
            qty,
            reason: it.reason ? String(it.reason) : null,
            note: it.note ? String(it.note) : null,
          },
        });
      }

      return tx.clothingSupplierReturn.findUnique({
        where: { return_id: header.return_id },
        include: {
          supplier: { select: { supplier_id: true, supplier_name: true } },
          items: true,
        },
      });
    });
  }

  // ======================================================
  // LIST
  // ======================================================
  async list(owner_id) {
    return prisma.clothingSupplierReturn.findMany({
      where: { owner_id },
      orderBy: { created_at: "desc" },
      include: {
        supplier: { select: { supplier_id: true, supplier_name: true, phone: true } },
        items: true,
      },
      take: 200,
    });
  }

  // ======================================================
  // GET BY ID
  // ======================================================
  async getById(owner_id, return_id) {
    return prisma.clothingSupplierReturn.findFirst({
      where: { owner_id, return_id },
      include: {
        supplier: { select: { supplier_id: true, supplier_name: true, phone: true } },
        items: {
          include: {
            lot: {
              include: {
                product: { select: { product_name: true } },
                size: { select: { size_name: true } },
                color: { select: { color_name: true } },
              },
            },
          },
        },
      },
    });
  }

  // ======================================================
  // UPDATE STATUS (STOCK CHANGES ONLY ON COMPLETED)
  // ======================================================
  async updateStatus(owner_id, return_id, status) {
    status = String(status || "").trim().toLowerCase();
    if (!allowedStatus.has(status)) {
      const e = new Error("Invalid status");
      e.status = 400;
      e.code = "VALIDATION_STATUS_INVALID";
      throw e;
    }

    return prisma.$transaction(async (tx) => {
      const ret = await tx.clothingSupplierReturn.findFirst({
        where: { owner_id, return_id },
        include: { items: true },
      });

      if (!ret) {
        const e = new Error("Return not found");
        e.status = 404;
        e.code = "RETURN_NOT_FOUND";
        throw e;
      }

      // ❌ cannot change after completed
      if (ret.status === "completed") {
        const e = new Error("Completed return cannot be modified");
        e.status = 400;
        e.code = "RETURN_ALREADY_COMPLETED";
        throw e;
      }

      // ✅ deduct stock ONLY when completing
      if (status === "completed") {
        for (const item of ret.items) {
          const lot = await tx.clothingStockLot.findFirst({
            where: { lot_id: item.lot_id, product: { owner_id } },
            select: { lot_id: true, qty_remaining: true },
          });

          if (!lot || Number(lot.qty_remaining) < item.qty) {
            const e = new Error("Not enough stock to complete supplier return");
            e.status = 400;
            e.code = "STOCK_NOT_ENOUGH";
            throw e;
          }

          await tx.clothingStockLot.update({
            where: { lot_id: item.lot_id },
            data: { qty_remaining: { decrement: item.qty } },
          });
        }
      }

      return tx.clothingSupplierReturn.update({
        where: { return_id },
        data: { status },
      });
    });
  }

  // ======================================================
  // CANCEL (NO STOCK CHANGE)
  // ======================================================
  async cancel(owner_id, return_id) {
    const ret = await prisma.clothingSupplierReturn.findFirst({
      where: { owner_id, return_id },
      select: { status: true },
    });

    if (!ret) {
      const e = new Error("Return not found");
      e.status = 404;
      e.code = "RETURN_NOT_FOUND";
      throw e;
    }

    if (ret.status === "completed") {
      const e = new Error("Completed return cannot be cancelled");
      e.status = 400;
      e.code = "RETURN_CANNOT_CANCEL";
      throw e;
    }

    return prisma.clothingSupplierReturn.update({
      where: { return_id },
      data: { status: "cancelled" },
    });
  }

  // ======================================================
  // DELETE (SAFE)
  // ======================================================
  async delete(owner_id, return_id) {
    const ret = await prisma.clothingSupplierReturn.findFirst({
      where: { owner_id, return_id },
      select: { status: true },
    });

    if (!ret) return null;

    if (ret.status === "completed") {
      const e = new Error("Completed return cannot be deleted");
      e.status = 400;
      e.code = "RETURN_CANNOT_DELETE";
      throw e;
    }

    await prisma.clothingSupplierReturn.delete({
      where: { return_id },
    });
    return true;
  }
}

module.exports = new ClothingSupplierReturnService();
