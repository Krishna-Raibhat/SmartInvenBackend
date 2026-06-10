// src/services/grocerySalesService.js
import prisma from "../config/prisma.js";
import { normalizeNepalPhone, isValidNepalPhone } from "../utils/phone.js";
import { Prisma } from "@prisma/client";

const Decimal = Prisma.Decimal;

class GrocerySalesService {
  async createSale(owner_id, payload) {
    const { customer_id, customer, paid_amount, payment_status, note, discount, items } = payload;

    if (!Array.isArray(items) || items.length === 0) {
      const e = new Error("At least one item is required");
      e.status = 400;
      e.code = "VALIDATION_NO_ITEMS";
      throw e;
    }

    const paid = Number(paid_amount ?? 0);
    if (!Number.isFinite(paid) || paid < 0) {
      const e = new Error("paid_amount must be a valid number");
      e.status = 400;
      e.code = "VALIDATION_PAID_INVALID";
      throw e;
    }

    const disc = Number(discount ?? 0);
    if (!Number.isFinite(disc) || disc < 0) {
      const e = new Error("discount must be a valid number >= 0");
      e.status = 400;
      e.code = "VALIDATION_DISCOUNT_INVALID";
      throw e;
    }

    let finalCustomerId = customer_id ?? null;

    if (finalCustomerId) {
      const cust = await prisma.customer.findFirst({
        where: { customer_id: finalCustomerId, owner_id },
        select: { customer_id: true },
      });
      if (!cust) {
        const e = new Error("Customer not found for this owner");
        e.status = 404;
        e.code = "CUSTOMER_NOT_FOUND";
        throw e;
      }
    } else if (customer?.phone) {
      const phone = normalizeNepalPhone(String(customer.phone).trim());

      if (!isValidNepalPhone(phone)) {
        const e = new Error("Invalid phone number. Please enter a valid 10-digit Nepali number.");
        e.status = 400;
        e.code = "VALIDATION_PHONE_INVALID";
        throw e;
      }

      const existing = await prisma.customer.findFirst({
        where: { owner_id, phone },
        select: { customer_id: true },
      });

      if (existing) {
        finalCustomerId = existing.customer_id;
      } else {
        const created = await prisma.customer.create({
          data: {
            owner_id,
            full_name: String(customer.full_name || "Walk-in Customer").trim(),
            phone,
            email: customer.email ? String(customer.email).trim() : null,
            address: customer.address ? String(customer.address).trim() : null,
          },
          select: { customer_id: true },
        });
        finalCustomerId = created.customer_id;
      }
    } else {
      finalCustomerId = null;
    }

    return prisma.$transaction(async (tx) => {
      const header = await tx.grocerySales.create({
        data: {
          owner_id,
          customer_id: finalCustomerId,
          payment_status: payment_status || "pending",
          total_amount: 0,
          discount: disc,
          paid_amount: paid,
          note: note ?? null,
        },
      });

      let totalAmount = new Decimal(0);
      const createdItems = [];

      for (const item of items) {
        const { product_id, lot_id, qty, sp, note: lineNote } = item;

        const qtyDecimal = new Decimal(qty);
        if (qtyDecimal.lte(0)) {
          const e = new Error("qty must be a positive number");
          e.status = 400;
          e.code = "VALIDATION_QTY_INVALID";
          throw e;
        }

        if (lot_id) {
          const lot = await tx.groceryStockLot.findFirst({
            where: { lot_id, product_id, owner_id },
            select: { lot_id: true, cp: true, sp: true, qty_remaining: true },
          });

          if (!lot) {
            const e = new Error("Stock lot not found for given product");
            e.status = 404;
            e.code = "LOT_NOT_FOUND";
            throw e;
          }

          const lotQtyRemaining = new Decimal(lot.qty_remaining);
          if (lotQtyRemaining.lt(qtyDecimal)) {
            const e = new Error("Not enough stock in selected lot");
            e.status = 400;
            e.code = "STOCK_NOT_ENOUGH";
            throw e;
          }

          await tx.groceryStockLot.update({
            where: { lot_id },
            data: { qty_remaining: { decrement: qtyDecimal } },
          });

          const sellingPrice = new Decimal(sp ?? lot.sp);
          if (sellingPrice.lt(0)) {
            const e = new Error("sp must be a valid positive number");
            e.status = 400;
            e.code = "VALIDATION_SP_INVALID";
            throw e;
          }

          const lineTotal = sellingPrice.mul(qtyDecimal);
          totalAmount = totalAmount.add(lineTotal);

          const created = await tx.grocerySalesItem.create({
            data: {
              sales_id: header.sales_id,
              product_id,
              lot_id,
              qty: qtyDecimal,
              cp: lot.cp,
              sp: sellingPrice,
              line_total: lineTotal,
              note: lineNote ?? null,
            },
          });

          createdItems.push(created);
        } else {
          const lots = await tx.groceryStockLot.findMany({
            where: { owner_id, product_id, qty_remaining: { gt: 0 } },
            orderBy: { created_at: "asc" },
            select: { lot_id: true, cp: true, sp: true, qty_remaining: true },
          });

          if (lots.length === 0) {
            const e = new Error("No stock available for this product");
            e.status = 400;
            e.code = "NO_STOCK_AVAILABLE";
            throw e;
          }

          let remainingQty = qtyDecimal;

          for (const lot of lots) {
            if (remainingQty.lte(0)) break;

            const lotQtyRemaining = new Decimal(lot.qty_remaining);
            const qtyToDeduct = Decimal.min(remainingQty, lotQtyRemaining);

            await tx.groceryStockLot.update({
              where: { lot_id: lot.lot_id },
              data: { qty_remaining: { decrement: qtyToDeduct } },
            });

            const sellingPrice = new Decimal(sp ?? lot.sp);
            if (sellingPrice.lt(0)) {
              const e = new Error("sp must be a valid positive number");
              e.status = 400;
              e.code = "VALIDATION_SP_INVALID";
              throw e;
            }

            const lineTotal = sellingPrice.mul(qtyToDeduct);
            totalAmount = totalAmount.add(lineTotal);

            const created = await tx.grocerySalesItem.create({
              data: {
                sales_id: header.sales_id,
                product_id,
                lot_id: lot.lot_id,
                qty: qtyToDeduct,
                cp: lot.cp,
                sp: sellingPrice,
                line_total: lineTotal,
                note: lineNote ?? null,
              },
            });

            createdItems.push(created);
            remainingQty = remainingQty.sub(qtyToDeduct);
          }

          if (remainingQty.gt(0)) {
            const e = new Error("Not enough stock available for this product");
            e.status = 400;
            e.code = "STOCK_NOT_ENOUGH";
            throw e;
          }
        }
      }

      const effectiveTotal = totalAmount.sub(disc);

      if (disc > totalAmount.toNumber()) {
        const e = new Error("Discount cannot exceed total amount");
        e.status = 400;
        e.code = "VALIDATION_DISCOUNT_EXCEEDS_TOTAL";
        throw e;
      }

      if (paid > effectiveTotal.toNumber() && payment_status !== "paid") {
        const e = new Error("paid_amount cannot be greater than effective total");
        e.status = 400;
        e.code = "VALIDATION_PAID_GT_TOTAL";
        throw e;
      }

      let finalStatus = "pending";
      if (payment_status === "paid") {
        finalStatus = "paid";
      } else if (payment_status === "partial") {
        finalStatus = "partial";
      } else {
        if (paid >= effectiveTotal.toNumber() && effectiveTotal.gt(0)) finalStatus = "paid";
        else if (paid > 0) finalStatus = "partial";
      }

      const updatedHeader = await tx.grocerySales.update({
        where: { sales_id: header.sales_id },
        data: {
          total_amount: totalAmount,
          discount: disc,
          paid_amount: paid,
          payment_status: finalStatus,
        },
      });

      return { ...updatedHeader, items: createdItems };
    });
  }

  async getById(owner_id, sales_id) {
    return prisma.grocerySales.findFirst({
      where: { sales_id, owner_id },
      include: {
        customer: {
          select: {
            customer_id: true,
            full_name: true,
            phone: true,
            email: true,
            address: true,
          },
        },
        items: {
          orderBy: { created_at: "asc" },
          include: {
            product: {
              select: {
                product_name: true,
                unit: { select: { unit_name: true } },
              },
            },
            lot: {
              select: { batch_no: true, expiry_date: true },
            },
          },
        },
      },
    });
  }

  async list(owner_id) {
    const sales = await prisma.grocerySales.findMany({
      where: { owner_id },
      orderBy: { created_at: "desc" },
      include: {
        customer: {
          select: { customer_id: true, full_name: true, phone: true },
        },
        items: {
          select: { returned_qty: true },
        },
        returns: {
          select: { refund_amount: true },
        },
      },
      take: 200,
    });

    return sales.map((sale) => {
      const total = Number(sale.total_amount || 0);
      const discount = Number(sale.discount || 0);
      const paid = Number(sale.paid_amount || 0);
      const effectiveTotal = total - discount;
      const totalRefunded = sale.returns.reduce(
        (sum, r) => sum + Number(r.refund_amount || 0),
        0
      );
      const remaining = Math.max(0, effectiveTotal - paid - totalRefunded);
      const netPaid = Math.max(0, paid - Math.max(0, totalRefunded - Math.max(0, effectiveTotal - paid)));

      let paymentStatus;
      if (remaining <= 0) paymentStatus = "paid";
      else if (netPaid > 0) paymentStatus = "partial";
      else paymentStatus = "pending";

      const hasReturn = sale.items.some((it) => Number(it.returned_qty || 0) > 0);
      const { returns, ...rest } = sale;
      
      return {
        ...rest,
        payment_status: paymentStatus,
        has_return: hasReturn,
      };
    });
  }

  async listCredit(owner_id) {
    const sales = await prisma.grocerySales.findMany({
      where: {
        owner_id,
        // Don't filter by payment_status here — we'll filter by actual due after calculating refunds
      },
      orderBy: { created_at: "desc" },
      include: {
        customer: {
          select: { customer_id: true, full_name: true, phone: true },
        },
        returns: {
          select: { refund_amount: true },
        },
      },
      take: 200,
    });

    // ✅ Filter by actual due amount (after refunds) instead of payment_status
    return sales
      .map((sale) => {
        const total = Number(sale.total_amount || 0);
        const discount = Number(sale.discount || 0);
        const paidRaw = Number(sale.paid_amount || 0);
        const effectiveTotal = total - discount;
        const totalRefunded = sale.returns.reduce(
          (sum, r) => sum + Number(r.refund_amount || 0),
          0
        );
        
        // Calculate net paid: if refund exceeds due, reduce paid by excess
        const dueBeforeRefund = Math.max(0, effectiveTotal - paidRaw);
        const excessRefund = Math.max(0, totalRefunded - dueBeforeRefund);
        const netPaid = Math.max(0, paidRaw - excessRefund);
        const due = Math.max(0, effectiveTotal - paidRaw - totalRefunded);

        return {
          sales_id: sale.sales_id,
          customer: sale.customer,
          payment_status: sale.payment_status,
          total_amount: total,
          discount,
          effective_total: effectiveTotal,
          paid_amount: netPaid, // Show net paid after refund adjustments
          total_refunded: totalRefunded,
          due_amount: due,
          created_at: sale.created_at,
        };
      })
      .filter((sale) => sale.due_amount > 0); // ✅ Only return sales with actual due > 0
  }

  async addPayment(owner_id, sales_id, add_amount) {
    const add = Number(add_amount);
    if (!Number.isFinite(add) || add <= 0) {
      const e = new Error("amount must be a positive number");
      e.status = 400;
      e.code = "VALIDATION_AMOUNT_INVALID";
      throw e;
    }

    return prisma.$transaction(async (tx) => {
      const sale = await tx.grocerySales.findFirst({
        where: { owner_id, sales_id },
        select: { sales_id: true, total_amount: true, discount: true, paid_amount: true },
      });
      if (!sale) {
        const e = new Error("Sale not found");
        e.status = 404;
        e.code = "SALE_NOT_FOUND";
        throw e;
      }

      const total = Number(sale.total_amount);
      const discount = Number(sale.discount || 0);
      const effectiveTotal = total - discount;
      const currentPaid = Number(sale.paid_amount);
      const newPaid = currentPaid + add;
      const remaining = effectiveTotal - currentPaid;

      if (add > remaining + 0.01) {
        const e = new Error(`Payment exceeds remaining amount. Remaining: ${remaining.toFixed(2)}`);
        e.status = 400;
        e.code = "PAYMENT_EXCEEDS_TOTAL";
        throw e;
      }

      const finalPaid = Math.min(newPaid, effectiveTotal);

      let status = "pending";
      if (finalPaid >= effectiveTotal - 0.01 && effectiveTotal > 0) status = "paid";
      else if (finalPaid > 0) status = "partial";

      return tx.grocerySales.update({
        where: { sales_id },
        data: { paid_amount: finalPaid, payment_status: status },
      });
    });
  }

  async getBill(owner_id, sales_id) {
    const sale = await this.getById(owner_id, sales_id);
    if (!sale) {
      const e = new Error("Sale not found");
      e.status = 404;
      e.code = "SALE_NOT_FOUND";
      throw e;
    }

    const owner = await prisma.owner.findUnique({
      where: { owner_id },
      select: { full_name: true, phone: true, email: true },
    });

    // Fetch total refunds for this sale
    const refundAgg = await prisma.groceryCustomerReturn.aggregate({
      where: { sales_id },
      _sum: { refund_amount: true },
    });
    const totalRefunded = Number(refundAgg._sum.refund_amount || 0);

    const total = Number(sale.total_amount);
    const discount = Number(sale.discount || 0);
    const paidRaw = Number(sale.paid_amount);
    const effectiveTotal = total - discount;
    
    // Calculate net paid: if refund exceeds due, reduce paid by excess
    const dueBeforeRefund = Math.max(0, effectiveTotal - paidRaw);
    const excessRefund = Math.max(0, totalRefunded - dueBeforeRefund);
    const netPaid = Math.max(0, paidRaw - excessRefund);
    const remaining = Math.max(0, effectiveTotal - paidRaw - totalRefunded);

    let paymentStatus = sale.payment_status;
    if (remaining <= 0) {
      paymentStatus = "paid";
    } else if (netPaid > 0) {
      paymentStatus = "partial";
    } else {
      paymentStatus = "pending";
    }

    return {
      sale_id: sale.sales_id,
      created_at: sale.created_at,
      payment_status: paymentStatus,
      totals: {
        total_amount: total,
        discount: discount,
        effective_total: effectiveTotal,
        paid_amount: netPaid, // Show net paid after refund adjustments
        total_refunded: totalRefunded,
        remaining_amount: remaining,
      },
      owner,
      customer: sale.customer,
      items: sale.items.map((it) => {
        const soldQty = Number(it.qty || 0);
        const returnedQty = Number(it.returned_qty || 0);
        const remainingQty = soldQty - returnedQty;

        return {
          sales_item_id: it.sales_item_id,
          product_name: it.product?.product_name,
          unit: it.product?.unit?.unit_name,
          batch_no: it.lot?.batch_no,
          expiry_date: it.lot?.expiry_date,
          
          sold_qty: soldQty,
          returned_qty: returnedQty,
          remaining_qty: remainingQty,
          
          cp: Number(it.cp),
          sp: Number(it.sp),
          line_total: Number(it.line_total),
          profit: (Number(it.sp) - Number(it.cp)) * remainingQty, // Profit on remaining qty only
          note: it.note,
        };
      }),
      note: sale.note,
    };
  }
}

export default new GrocerySalesService();