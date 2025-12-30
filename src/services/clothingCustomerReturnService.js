// src/services/clothingCustomerReturnService.js
const prisma = require("../prisma/client");

class ClothingCustomerReturnService {
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
      // 1) Load sale (must belong to owner)
      const sale = await tx.clothingSales.findFirst({
        where: { sales_id, owner_id },
        select: { sales_id: true, total_amount: true, paid_amount: true, payment_status: true },
      });

      if (!sale) {
        const e = new Error("Sale not found");
        e.status = 404;
        e.code = "SALE_NOT_FOUND";
        throw e;
      }

      // 2) Create return header (refund computed later)
      const ret = await tx.clothingCustomerReturn.create({
        data: {
          owner_id,
          sales_id,
          refund_amount: 0,
          note: note ?? null,
        },
      });

      let returnValue = 0;

      // 3) Process each return line
      for (const it of items) {
        const sales_item_id = it.sales_item_id;
        const qty = Number(it.qty);
        const condition = String(it.condition || "good").toLowerCase();

        if (!sales_item_id) {
          const e = new Error("sales_item_id is required for each return item");
          e.status = 400;
          e.code = "VALIDATION_SALES_ITEM_ID_REQUIRED";
          throw e;
        }

        if (!Number.isInteger(qty) || qty <= 0) {
          const e = new Error("qty must be a positive integer");
          e.status = 400;
          e.code = "VALIDATION_QTY_INVALID";
          throw e;
        }

        if (condition !== "good" && condition !== "damaged") {
          const e = new Error("condition must be 'good' or 'damaged'");
          e.status = 400;
          e.code = "VALIDATION_CONDITION_INVALID";
          throw e;
        }

        // Load the sales item (must belong to this sale)
        const salesItem = await tx.clothingSalesItem.findFirst({
          where: { sales_item_id, sales_id },
          select: {
            sales_item_id: true,
            lot_id: true,
            qty: true,
            sp: true,
          },
        });

        if (!salesItem) {
          const e = new Error("Sales item not found in this sale");
          e.status = 404;
          e.code = "SALES_ITEM_NOT_FOUND";
          throw e;
        }

        // ✅ Prevent returning more than sold (consider previous returns)
        const alreadyReturned = await tx.clothingCustomerReturnItem.aggregate({
          where: { sales_item_id },
          _sum: { qty: true },
        });

        const returnedQty = Number(alreadyReturned._sum.qty || 0);
        const availableToReturn = Number(salesItem.qty) - returnedQty;

        if (qty > availableToReturn) {
          const e = new Error(
            `Return qty exceeds remaining. Sold=${salesItem.qty}, AlreadyReturned=${returnedQty}, Remaining=${availableToReturn}`
          );
          e.status = 400;
          e.code = "RETURN_EXCEEDS_SOLD";
          throw e;
        }

        // Create return item
        await tx.clothingCustomerReturnItem.create({
          data: {
            return_id: ret.return_id,
            sales_item_id,
            lot_id: salesItem.lot_id,
            qty,
            condition,
            note: it.note ?? null,
          },
        });

        // ✅ Restock only if condition is good
        if (condition === "good") {
          await tx.clothingStockLot.update({
            where: { lot_id: salesItem.lot_id },
            data: { qty_remaining: { increment: qty } },
          });
        }

        // return value uses sell-time price from sales item (important!)
        returnValue += Number(salesItem.sp) * qty;
      }

      // 4) Update sale totals & handle refund if needed
      const oldTotal = Number(sale.total_amount);
      const oldPaid = Number(sale.paid_amount);

      const newTotal = Math.max(0, oldTotal - returnValue);

      let refund = 0;
      let newPaid = oldPaid;

      if (oldPaid > newTotal) {
        refund = oldPaid - newTotal;
        newPaid = newTotal; // net paid after refund
      }

      let status = "pending";
      if (newPaid >= newTotal && newTotal > 0) status = "paid";
      else if (newPaid > 0) status = "partial";

      await tx.clothingSales.update({
        where: { sales_id },
        data: {
          total_amount: newTotal,
          paid_amount: newPaid,
          payment_status: status,
        },
      });

      // 5) Update return header refund_amount
      const updatedReturn = await tx.clothingCustomerReturn.update({
        where: { return_id: ret.return_id },
        data: { refund_amount: refund },
        include: {
          items: true,
        },
      });

      return {
        return: updatedReturn,
        sale_after_return: {
          sales_id,
          old_total: oldTotal,
          old_paid: oldPaid,
          return_value: returnValue,
          new_total: newTotal,
          new_paid: newPaid,
          refund_amount: refund,
          payment_status: status,
        },
      };
    });
  }

  async list(owner_id) {
    return prisma.clothingCustomerReturn.findMany({
      where: { owner_id },
      orderBy: { created_at: "desc" },
      include: {
        sales: { select: { sales_id: true } },
        items: true,
      },
      take: 200,
    });
  }

  async getById(owner_id, return_id) {
    return prisma.clothingCustomerReturn.findFirst({
      where: { owner_id, return_id },
      include: {
        sales: { select: { sales_id: true, total_amount: true, paid_amount: true, payment_status: true } },
        items: {
          include: {
            salesItem: {
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
}

module.exports = new ClothingCustomerReturnService();
