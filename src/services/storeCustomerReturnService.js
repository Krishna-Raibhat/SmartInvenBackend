// src/services/storeCustomerReturnService.js
import { prisma } from "../prisma/client.js";

class StoreCustomerReturnService {
  /**
   * Create a customer return — items only (lot-based products).
   * Restocks the lot and records refund_amount.
   */
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

    // Validate amounts upfront
    for (const item of items) {
      if (item.amount === undefined || item.amount === null) {
        const e = new Error("Each return item must have an amount");
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
      // Verify sale belongs to owner
      const sale = await tx.storeSales.findFirst({
        where: { sales_id, owner_id },
        select: { sales_id: true, total_amount: true, paid_amount: true },
      });

      if (!sale) {
        const e = new Error("Sale not found");
        e.status = 404;
        e.code = "SALE_NOT_FOUND";
        throw e;
      }

      // Create return header
      const ret = await tx.storeCustomerReturn.create({
        data: { owner_id, sales_id, refund_amount: 0, note: note ?? null },
      });

      let totalRefund = 0;

      for (const it of items) {
        const sales_item_id = String(it.sales_item_id || "").trim();
        const qty = Number(it.qty);

        if (!sales_item_id) {
          const e = new Error("sales_item_id is required for each item");
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

        // Load the sales item
        const salesItem = await tx.storeSalesItem.findFirst({
          where: { sales_item_id, sales_id },
          select: {
            sales_item_id: true,
            lot_id: true,
            qty: true,
            returned_qty: true,
            sp: true,
            product: { select: { type: true, product_name: true } },
          },
        });

        if (!salesItem) {
          const e = new Error(`Sales item ${sales_item_id} not found`);
          e.status = 404;
          e.code = "SALES_ITEM_NOT_FOUND";
          throw e;
        }

        // Only allow returns for items (not services)
        if (salesItem.product.type !== "item") {
          const e = new Error(
            `"${salesItem.product.product_name}" is a service and cannot be returned`,
          );
          e.status = 400;
          e.code = "SERVICE_NOT_RETURNABLE";
          throw e;
        }

        if (!salesItem.lot_id) {
          const e = new Error(
            `Sales item ${sales_item_id} has no associated lot`,
          );
          e.status = 400;
          e.code = "NO_LOT_ON_ITEM";
          throw e;
        }

        const availableToReturn = salesItem.qty - (salesItem.returned_qty ?? 0);
        if (qty > availableToReturn) {
          const e = new Error(
            `Return qty (${qty}) exceeds available qty to return (${availableToReturn})`,
          );
          e.status = 400;
          e.code = "RETURN_EXCEEDS_SOLD";
          throw e;
        }

        const itemAmount = Number(it.amount);

        // Create return item
        await tx.storeCustomerReturnItem.create({
          data: {
            owner_id,

            return_id: ret.return_id,
            sales_item_id,
            lot_id: salesItem.lot_id,

            qty,
            amount: itemAmount,
            note: it.note ?? null,
          },
        });

        // Update returned_qty on sales item
        await tx.storeSalesItem.update({
          where: { sales_item_id },
          data: { returned_qty: { increment: qty } },
        });

        // Restock the lot
        await tx.storeStockLot.update({
          where: { lot_id: salesItem.lot_id },
          data: { qty_remaining: { increment: qty } },
        });

        totalRefund += itemAmount;
      }

      // Update return header with final refund amount
      const updatedReturn = await tx.storeCustomerReturn.update({
        where: { return_id: ret.return_id },
        data: { refund_amount: totalRefund },
        include: { items: true },
      });

      return {
        return: updatedReturn,
        sale_info: {
          sales_id,
          original_total: Number(sale.total_amount),
          original_paid: Number(sale.paid_amount),
          refund_amount: totalRefund,
        },
      };
    });
  }

  async getById(owner_id, return_id) {
    const ret = await prisma.storeCustomerReturn.findFirst({
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
    return this._format(ret);
  }

  _format(ret) {
    return {
      return: {
        return_id: ret.return_id,
        sales_id: ret.sales_id,
        refund_amount: Number(ret.refund_amount),
        note: ret.note,
        created_at: ret.created_at,
      },
      sale: ret.sales
        ? {
            sales_id: ret.sales.sales_id,
            customer: ret.sales.customer,
            total_amount: Number(ret.sales.total_amount),
            discount: Number(ret.sales.discount ?? 0),
            paid_amount: Number(ret.sales.paid_amount),
            created_at: ret.sales.created_at,
          }
        : null,
      items: ret.items.map((itm) => ({
        return_item_id: itm.return_item_id,
        sales_item_id: itm.sales_item_id,
        lot_id: itm.lot_id,
        qty: itm.qty,
        amount: Number(itm.amount),
        note: itm.note,
        product: itm.lot?.product ?? null,
        cp: itm.lot ? Number(itm.lot.cp) : null,
        sp: itm.lot ? Number(itm.lot.sp) : null,
        created_at: itm.created_at,
      })),
    };
  }
}

export default new StoreCustomerReturnService();
