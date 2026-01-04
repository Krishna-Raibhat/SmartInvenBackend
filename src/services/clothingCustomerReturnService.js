// src/services/clothingCustomerReturnService.js
const { prisma } = require("../prisma/client");

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
      /* =========================
         1️⃣ Load Sale
      ========================= */
      const sale = await tx.clothingSales.findFirst({
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
      const ret = await tx.clothingCustomerReturn.create({
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
        const condition = String(it.condition || "good").toLowerCase();

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

        if (!["good", "damaged"].includes(condition)) {
          throw Object.assign(new Error("condition must be good or damaged"), {
            status: 400,
            code: "VALIDATION_CONDITION_INVALID",
          });
        }

        /* =========================
           3.1 Load Sales Item
        ========================= */
        const salesItem = await tx.clothingSalesItem.findFirst({
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
              `Return exceeds available qty. Remaining=${availableToReturn}`
            ),
            { status: 400, code: "RETURN_EXCEEDS_SOLD" }
          );
        }

        /* =========================
           3.2 Validate Lot Ownership
        ========================= */
        const lotCheck = await tx.clothingStockLot.findFirst({
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

        /* =========================
           3.4 Update Sales Item (returned_qty)
        ========================= */
        await tx.clothingSalesItem.update({
          where: { sales_item_id },
          data: {
            returned_qty: { increment: qty },
          },
        });

        /* =========================
           3.5 Restock if GOOD
        ========================= */
        if (condition === "good") {
          await tx.clothingStockLot.update({
            where: { lot_id: salesItem.lot_id },
            data: {
              qty_remaining: { increment: qty },
            },
          });
        }

        returnValue += Number(salesItem.sp) * qty;
      }

      /* =========================
         4️⃣ Update Sale Totals
      ========================= */
      const oldTotal = Number(sale.total_amount);
      const oldPaid = Number(sale.paid_amount);

      const newTotal = Math.max(0, oldTotal - returnValue);

      let refund = 0;
      let newPaid = oldPaid;

      if (oldPaid > newTotal) {
        refund = oldPaid - newTotal;
        newPaid = newTotal;
      }

      let status = "pending";
      if (newTotal === 0 || newPaid >= newTotal) status = "paid";
      else if (newPaid > 0) status = "partial";

      await tx.clothingSales.update({
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
      const updatedReturn = await tx.clothingCustomerReturn.update({
        where: { return_id: ret.return_id },
        data: { refund_amount: refund },
        include: { items: true },
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
          remaining_amount: Math.max(0, newTotal - newPaid),
          payment_status: status,
        },
      };
    });
  }

  /* =========================
     LIST RETURNS
  ========================= */
  async list(owner_id) {
    return prisma.clothingCustomerReturn.findMany({
      where: { owner_id },
      orderBy: { created_at: "desc" },
      include: { items: true },
      take: 200,
    });
  }

  /* =========================
     GET RETURN DETAILS
  ========================= */
  async getById(owner_id, return_id) {
    return prisma.clothingCustomerReturn.findFirst({
      where: { owner_id, return_id },
      include: {
        sales: {
          select: {
            sales_id: true,
            total_amount: true,
            paid_amount: true,
            payment_status: true,
          },
        },
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
