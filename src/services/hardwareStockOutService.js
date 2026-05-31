// src/services/hardwareStockOutService.js
import { prisma } from "../prisma/client.js";
import { normalizeNepalPhone, isValidNepalPhone } from "../utils/phone.js";

class HardwareStockOutService {
  async createStockOut({
    owner_id,
    customer_name,
    customer_phn_number,
    customer_address,
    payment_status,
    paid_amount,
    discount_amount, // ✅ NEW
    note,
    items,
  }) {
    if (!Array.isArray(items) || items.length === 0) {
      const err = new Error("At least one item is required");
      err.status = 400;
      err.code = "VALIDATION_NO_ITEMS";
      throw err;
    }

    // ✅ Validate phone number if provided
    if (customer_phn_number) {
      const normalizedPhone = normalizeNepalPhone(String(customer_phn_number).trim());
      if (!isValidNepalPhone(normalizedPhone)) {
        const err = new Error("Invalid phone number. Please enter a valid 10-digit Nepali number.");
        err.status = 400;
        err.code = "VALIDATION_PHONE_INVALID";
        throw err;
      }
    }

    // ✅ Validate paid amount
    const paid = Number(paid_amount || 0);
    if (!Number.isFinite(paid) || paid < 0) {
      const err = new Error("paid_amount must be a valid number >= 0");
      err.status = 400;
      err.code = "VALIDATION_PAID_INVALID";
      throw err;
    }

    // ✅ Validate discount
    const discount = Number(discount_amount || 0);
    if (!Number.isFinite(discount) || discount < 0) {
      const err = new Error("discount_amount must be a valid number >= 0");
      err.status = 400;
      err.code = "VALIDATION_DISCOUNT_INVALID";
      throw err;
    }

    return prisma.$transaction(async (tx) => {
      const header = await tx.hardwareStockOut.create({
        data: {
          owner_id,
          customer_name: customer_name ?? null,
          customer_phn_number: customer_phn_number ?? null,
          customer_address: customer_address ?? null,
          payment_status: payment_status || "pending",
          total_amount: 0,
          discount: discount,  // ✅ save discount
          paid_amount: paid,
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

        const sellingPrice = Number(sp);
        if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
          const err = new Error("sp must be a positive number");
          err.status = 400;
          err.code = "VALIDATION_SP_INVALID";
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

        // atomic decrement
        await tx.hardwareStockLot.update({
          where: { lot_id },
          data: { qty_remaining: { decrement: q } },
        });

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

      // ✅ effective total = total - discount
      // Example: total=12900, discount=900 → effectiveTotal=12000
      // paid=10000 → due=2000 (not 2900)
      const effectiveTotal = totalAmount - discount;

      // ✅ validate discount doesn't exceed total
      if (discount > totalAmount) {
        const err = new Error("Discount cannot exceed total amount");
        err.status = 400;
        err.code = "VALIDATION_DISCOUNT_EXCEEDS_TOTAL";
        throw err;
      }

      // ✅ payment status based on effectiveTotal
      let finalStatus = "pending";
      if (payment_status === "paid") {
        finalStatus = "paid";  // owner explicitly marked as completed
      } else if (paid >= effectiveTotal && effectiveTotal > 0) {
        finalStatus = "paid";
      } else if (paid > 0 && paid < effectiveTotal) {
        finalStatus = "partial";
      }

      const updatedHeader = await tx.hardwareStockOut.update({
        where: { stockout_id: header.stockout_id },
        data: {
          total_amount: totalAmount,   // gross total (12900)
          discount: discount,          // discount given (900)
          paid_amount: paid,           // what customer paid (10000)
          payment_status: finalStatus, // partial (due=2000)
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

  // ✅ addPayment uses effectiveTotal (total - discount) for status
  async addPayment(owner_id, stockout_id, add_amount) {
    const add = Number(add_amount);
    if (!Number.isFinite(add) || add <= 0) {
      const err = new Error("amount must be a positive number");
      err.status = 400;
      err.code = "VALIDATION_AMOUNT_INVALID";
      throw err;
    }

    return prisma.$transaction(async (tx) => {
      const stockOut = await tx.hardwareStockOut.findFirst({
        where: { owner_id, stockout_id },
        select: {
          stockout_id: true,
          total_amount: true,
          discount: true,      // ✅ fetch discount too
          paid_amount: true,
        },
      });

      if (!stockOut) {
        const err = new Error("Stock out not found");
        err.status = 404;
        err.code = "STOCKOUT_NOT_FOUND";
        throw err;
      }

      const total       = Number(stockOut.total_amount);
      const discount    = Number(stockOut.discount || 0);
      const effectiveTotal = total - discount; // ✅ use effective total
      const currentPaid = Number(stockOut.paid_amount);
      const newPaid     = currentPaid + add;

      let status = "pending";
      if (newPaid >= effectiveTotal && effectiveTotal > 0) status = "paid";
      else if (newPaid > 0) status = "partial";

      return tx.hardwareStockOut.update({
        where: { stockout_id },
        data: { paid_amount: newPaid, payment_status: status },
      });
    });
  }
}

export default new HardwareStockOutService();
