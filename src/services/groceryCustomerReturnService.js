// src/services/groceryCustomerReturnService.js
import prisma from "../config/prisma.js";
import { Prisma } from "@prisma/client";

const Decimal = Prisma.Decimal;

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

      let returnValue = new Decimal(0);

      /* =========================
         3️⃣ Process Items
      ========================= */
      for (const it of items) {
        const sales_item_id = String(it.sales_item_id || "").trim();
        const qty = new Decimal(it.qty);

        if (!sales_item_id) {
          throw Object.assign(new Error("sales_item_id required"), {
            status: 400,
            code: "VALIDATION_SALES_ITEM_ID_REQUIRED",
          });
        }

        if (qty.lte(0)) {
          throw Object.assign(new Error("qty must be positive"), {
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

        const soldQty = new Decimal(salesItem.qty);
        const returnedQty = new Decimal(salesItem.returned_qty || 0);
        const availableToReturn = soldQty.sub(returnedQty);

        if (qty.gt(availableToReturn)) {
          throw Object.assign(
            new Error(
              `Return exceeds available qty. Remaining=${availableToReturn.toString()}`,
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
            owner_id,
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
           3.5 Always Restock (add back to lot)
        ========================= */
        await tx.groceryStockLot.update({
          where: { lot_id: salesItem.lot_id },
          data: {
            qty_remaining: { increment: qty },
          },
        });

        const sp = new Decimal(salesItem.sp);
        returnValue = returnValue.add(sp.mul(qty));
      }

      /* =========================
         4️⃣ Update Sale Totals
      ========================= */
      const oldTotal = new Decimal(sale.total_amount);
      const oldPaid = new Decimal(sale.paid_amount);

      const newTotal = Decimal.max(0, oldTotal.sub(returnValue));

      let refund = new Decimal(0);
      let newPaid = oldPaid;

      if (oldPaid.gt(newTotal)) {
        refund = oldPaid.sub(newTotal);
        newPaid = newTotal;
      }

      let status = "pending";
      if (newTotal.eq(0) || newPaid.gte(newTotal)) status = "paid";
      else if (newPaid.gt(0)) status = "partial";

      await tx.grocerySales.update({
        where: { sales_id },
        data: {
          total_amount: newTotal,
          paid_amount: newPaid,
          payment_status: status,
        },
      });

      /* =========================
         5️⃣ Update Return Header
      ========================= */
      const updatedReturn = await tx.groceryCustomerReturn.update({
        where: { return_id: ret.return_id },
        data: { refund_amount: refund },
        include: { items: true },
      });

      return {
        return: updatedReturn,
        sale_after_return: {
          sales_id,
          old_total: oldTotal.toNumber(),
          old_paid: oldPaid.toNumber(),
          return_value: returnValue.toNumber(),
          new_total: newTotal.toNumber(),
          new_paid: newPaid.toNumber(),
          refund_amount: refund.toNumber(),
          remaining_amount: Math.max(0, newTotal.sub(newPaid).toNumber()),
          payment_status: status,
        },
      };
    });
  }

  /* =========================
     LIST RETURNS
  ========================= */
  async list(owner_id) {
    return prisma.groceryCustomerReturn.findMany({
      where: { owner_id },
      orderBy: { created_at: "desc" },
      include: {
        sales: {
          include: {
            customer: {
              select: {
                customer_id: true,
                full_name: true,
                phone: true,
              },
            },
          },
        },
        items: {
          include: {
            salesItem: {
              include: {
                product: {
                  select: {
                    product_id: true,
                    product_name: true,
                    unit: {
                      select: {
                        unit_name: true,
                      },
                    },
                  },
                },
              },
            },
            lot: {
              select: {
                batch_no: true,
                expiry_date: true,
              },
            },
          },
        },
      },
      take: 200,
    });
  }

  /* =========================
     GET RETURN DETAILS
  ========================= */
  async getById(owner_id, return_id) {
    return prisma.groceryCustomerReturn.findFirst({
      where: { owner_id, return_id },
      include: {
        sales: {
          select: {
            sales_id: true,
            total_amount: true,
            paid_amount: true,
            payment_status: true,
            customer: {
              select: {
                customer_id: true,
                full_name: true,
                phone: true,
              },
            },
          },
        },
        items: {
          include: {
            salesItem: {
              include: {
                product: {
                  select: {
                    product_name: true,
                    unit: {
                      select: {
                        unit_name: true,
                      },
                    },
                  },
                },
              },
            },
            lot: {
              select: {
                batch_no: true,
                expiry_date: true,
              },
            },
          },
        },
      },
    });
  }
}

export default new GroceryCustomerReturnService();
