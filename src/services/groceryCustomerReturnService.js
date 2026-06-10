// src/services/groceryCustomerReturnService.js
import { prisma } from "../prisma/client.js";

class GroceryCustomerReturnService {
  async createReturn(owner_id, payload) {
    const { sales_id, note, items } = payload;

    if (!sales_id) {
      const e = new Error("sales_id is required");
      e.status = 400;
      e.code = "VALIDATION_SALES_ID_REQUIRED";
      throw e;
    }

    if (!Array.isArray(items) || items.length === 0) {
      const e = new Error("At least one return item is required");
      e.status = 400;
      e.code = "VALIDATION_NO_ITEMS";
      throw e;
    }

    // Validate that each item has an amount
    for (const item of items) {
      if (item.amount === undefined || item.amount === null) {
        const e = new Error("Each return item must have an amount specified");
        e.status = 400;
        e.code = "VALIDATION_AMOUNT_REQUIRED";
        throw e;
      }
      const amt = Number(item.amount);
      if (!Number.isFinite(amt) || amt < 0) {
        const e = new Error("Item amount must be a valid non-negative number");
        e.status = 400;
        e.code = "VALIDATION_AMOUNT_INVALID";
        throw e;
      }
    }

    return prisma.$transaction(async (tx) => {
      /* =========================
         1️⃣ Load Sale
      ========================= */
      const sale = await tx.grocerySales.findFirst({
        where: { sales_id, owner_id },
        select: {
          sales_id: true,
          total_amount: true,
          paid_amount: true,
        },
      });

      if (!sale) {
        const e = new Error("Sale not found");
        e.status = 404;
        e.code = "SALE_NOT_FOUND";
        throw e;
      }

      /* =========================
         2️⃣ Create Return Header
      ========================= */
      const ret = await tx.groceryCustomerReturn.create({
        data: {
          owner_id,
          sales_id,
          refund_amount: 0,
          note: note ?? null,
        },
      });

      let returnValue = 0;

      /* =========================
         3️⃣ Process Items
      ========================= */
      for (const it of items) {
        const sales_item_id = String(it.sales_item_id || "").trim();
        const qty = Number(it.qty);

        if (!sales_item_id) {
          throw Object.assign(new Error("sales_item_id required"), {
            status: 400,
            code: "VALIDATION_SALES_ITEM_ID_REQUIRED",
          });
        }

        if (!Number.isInteger(qty) || qty <= 0) {
          throw Object.assign(new Error("qty must be positive integer"), {
            status: 400,
            code: "VALIDATION_QTY_INVALID",
          });
        }

        /* =========================
           3.1 Load Sales Item
        ========================= */
        const salesItem = await tx.grocerySalesItem.findFirst({
          where: { sales_item_id, sales_id },
          select: {
            sales_item_id: true,
            lot_id: true,
            qty: true,
            returned_qty: true,
            sp: true,
          },
        });

        if (!salesItem) {
          throw Object.assign(new Error("Sales item not found"), {
            status: 404,
            code: "SALES_ITEM_NOT_FOUND",
          });
        }

        const availableToReturn =
          Number(salesItem.qty) - Number(salesItem.returned_qty || 0);

        if (qty > availableToReturn) {
          throw Object.assign(
            new Error(
              `Return exceeds available qty. Remaining=${availableToReturn}`,
            ),
            { status: 400, code: "RETURN_EXCEEDS_SOLD" },
          );
        }

        /* =========================
           3.2 Validate Lot Ownership
        ========================= */
        const lotCheck = await tx.groceryStockLot.findFirst({
          where: {
            lot_id: salesItem.lot_id,
            product: { owner_id },
          },
          select: { lot_id: true },
        });

        if (!lotCheck) {
          throw Object.assign(new Error("Invalid lot for owner"), {
            status: 403,
            code: "LOT_OWNER_MISMATCH",
          });
        }

        /* =========================
           3.3 Create Return Item
        ========================= */
        const itemAmount = Number(it.amount || 0);
        
        await tx.groceryCustomerReturnItem.create({
          data: {
            return_id: ret.return_id,
            sales_item_id,
            lot_id: salesItem.lot_id,
            qty,
            amount: itemAmount,
            note: it.note ?? null,
          },
        });

        /* =========================
           3.4 Update Sales Item (returned_qty)
        ========================= */
        await tx.grocerySalesItem.update({
          where: { sales_item_id },
          data: {
            returned_qty: { increment: qty },
          },
        });

        /* =========================
           3.5 Restock (All returns are restocked)
        ========================= */
        await tx.groceryStockLot.update({
          where: { lot_id: salesItem.lot_id },
          data: {
            qty_remaining: { increment: qty },
          },
        });

        // Add item amount to total refund
        returnValue += itemAmount;
      }

      /* =========================
         4️⃣ Calculate Refund (Don't modify sale totals)
      ========================= */
      // The sale record stays unchanged
      // We only track the refund amount in the return record
      const refundAmount = returnValue;

      /* =========================
         5️⃣ Update Return Header with Refund
      ========================= */
      const updatedReturn = await tx.groceryCustomerReturn.update({
        where: { return_id: ret.return_id },
        data: { refund_amount: refundAmount },
        include: { items: true },
      });

      return {
        return: updatedReturn,
        sale_info: {
          sales_id,
          original_total: Number(sale.total_amount),
          original_paid: Number(sale.paid_amount),
          refund_amount: refundAmount,
          note: "Sale totals remain unchanged. Revenue calculation done at reporting level.",
        },
      };
    });
  }

  async list(owner_id) {
    const returns = await prisma.groceryCustomerReturn.findMany({
      where: { owner_id },
      orderBy: { created_at: "desc" },
      include: {
        sales: {
          select: {
            sales_id: true,
            total_amount: true,
            discount: true,
            paid_amount: true,
            created_at: true,
            customer: {
              select: { customer_id: true, full_name: true, phone: true },
            },
          },
        },
        items: {
          include: {
            lot: {
              select: {
                lot_id: true,
                cp: true,
                sp: true,
                product: { select: { product_id: true, product_name: true } },
              },
            },
          },
        },
      },
      take: 100,
    });

    return returns.map((ret) => ({
      return: {
        return_id: ret.return_id,
        sales_id: ret.sales_id,
        refund_amount: Number(ret.refund_amount || 0),
        note: ret.note,
        created_at: ret.created_at,
      },
      sale: ret.sales
        ? {
            sales_id: ret.sales.sales_id,
            customer: ret.sales.customer,
            total_amount: Number(ret.sales.total_amount),
            discount: Number(ret.sales.discount || 0),
            paid_amount: Number(ret.sales.paid_amount),
            created_at: ret.sales.created_at,
          }
        : null,
      items: ret.items.map((itm) => ({
        return_item_id: itm.return_item_id,
        lot_id: itm.lot_id,
        sales_item_id: itm.sales_item_id,
        qty: itm.qty,
        amount: Number(itm.amount),
        note: itm.note,
        product: itm.lot.product,
        cp: Number(itm.lot.cp),
        sp: Number(itm.lot.sp),
        created_at: itm.created_at,
      })),
    }));
  }

  async getById(owner_id, return_id) {
    const ret = await prisma.groceryCustomerReturn.findFirst({
      where: { return_id, owner_id },
      include: {
        sales: {
          select: {
            sales_id: true,
            total_amount: true,
            discount: true,
            paid_amount: true,
            created_at: true,
            customer: {
              select: { customer_id: true, full_name: true, phone: true },
            },
          },
        },
        items: {
          include: {
            lot: {
              select: {
                lot_id: true,
                cp: true,
                sp: true,
                product: { select: { product_id: true, product_name: true } },
              },
            },
          },
        },
      },
    });

    if (!ret) return null;

    return {
      return: {
        return_id: ret.return_id,
        sales_id: ret.sales_id,
        refund_amount: Number(ret.refund_amount || 0),
        note: ret.note,
        created_at: ret.created_at,
      },
      sale: ret.sales
        ? {
            sales_id: ret.sales.sales_id,
            customer: ret.sales.customer,
            total_amount: Number(ret.sales.total_amount),
            discount: Number(ret.sales.discount || 0),
            paid_amount: Number(ret.sales.paid_amount),
            created_at: ret.sales.created_at,
          }
        : null,
      items: ret.items.map((itm) => ({
        return_item_id: itm.return_item_id,
        lot_id: itm.lot_id,
        sales_item_id: itm.sales_item_id,
        qty: itm.qty,
        amount: Number(itm.amount),
        note: itm.note,
        product: itm.lot.product,
        cp: Number(itm.lot.cp),
        sp: Number(itm.lot.sp),
        created_at: itm.created_at,
      })),
    };
  }
}

export default new GroceryCustomerReturnService();
