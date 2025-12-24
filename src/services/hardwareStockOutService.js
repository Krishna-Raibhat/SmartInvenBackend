// src/services/hardwareStockOutService.js
const prisma = require("../prisma/client");

class HardwareStockOutService {
  async createStockOut({ owner_id, sold_by, customer_name, customer_phn_number, customer_address, payment_status, paid_amount, note, items }) {
    if (!Array.isArray(items) || items.length === 0) {
      const err = new Error("At least one item is required");
      err.status = 400;
      err.code = "VALIDATION_NO_ITEMS";
      throw err;
    }

    return prisma.$transaction(async (tx) => {
      const header = await tx.hardwareStockOut.create({
        data: {
          owner_id,
          customer_name: customer_name || null,
          customer_phn_number: customer_phn_number || null,
          customer_address: customer_address || null,
          
          payment_status: payment_status || "pending",
          paid_amount: Number(paid_amount || 0),
          note: note ?? null,
        },
      });

      let totalAmount = 0;
      const createdItems = [];

      for (const item of items) {
        const { product_id, lot_id, qty, sp, note: lineNote } = item;

        const q = Number(qty);
        if (!Number.isInteger(q) || q <= 0) {
          const err = new Error("qty must be a positive integer");
          err.status = 400;
          err.code = "VALIDATION_QTY_INVALID";
          throw err;
        }

        const lot = await tx.hardwareStockLot.findFirst({
          where: { owner_id, lot_id, product_id },
        });

        if (!lot) {
          const err = new Error("Stock lot not found");
          err.status = 404;
          err.code = "LOT_NOT_FOUND";
          throw err;
        }

        if (lot.qty_remaining < q) {
          const err = new Error("Not enough stock in selected lot");
          err.status = 400;
          err.code = "STOCK_NOT_ENOUGH";
          throw err;
        }

        await tx.hardwareStockLot.update({
          where: { lot_id },
          data: { qty_remaining: { decrement: q } },
        });

        const sellingPrice = Number(sp);
        const lineTotal = sellingPrice * q;
        totalAmount += lineTotal;

        const created = await tx.hardwareStockOutItem.create({
          data: {
            owner_id,
            stockout_id: header.stockout_id,
            product_id,
            lot_id,
            qty: q,
            cp: lot.cp,
            sp: sellingPrice,
            note: lineNote ?? null,
            line_total: lineTotal,
          },
        });

        createdItems.push(created);
      }

      if (paid_amount > totalAmount) {
        const err = new Error("paid_amount cannot be greater than total_amount");
        err.status = 400;
        err.code = "VALIDATION_PAID_GT_TOTAL";
        throw err;
      }

      let finalStatus = "pending";
      if (paid_amount >= totalAmount) finalStatus = "paid";
      else if (paid_amount > 0) finalStatus = "partial";

      const updatedHeader = await tx.hardwareStockOut.update({
        where: { stockout_id: header.stockout_id },
        data: {
          total_amount: totalAmount,
          payment_status: finalStatus,
        },
      });

      return { header: updatedHeader, items: createdItems };
    });
  }

  async getStockOutById(owner_id, stockout_id) {
    const header = await prisma.hardwareStockOut.findFirst({
      where: { owner_id, stockout_id },
    });
    if (!header) return null;

    const items = await prisma.hardwareStockOutItem.findMany({
      where: { owner_id, stockout_id },
      orderBy: { created_at: "asc" },
    });

    return { header, items };
  }

  async listStockOut(owner_id) {
    return prisma.hardwareStockOut.findMany({
      where: { owner_id },
      orderBy: { created_at: "desc" },
    });
  }
}

module.exports = new HardwareStockOutService();
