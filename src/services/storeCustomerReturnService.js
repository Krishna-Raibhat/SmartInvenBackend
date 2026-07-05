// src/services/storeCustomerReturnService.js
import { prisma } from "../prisma/client.js";
import { Prisma } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const Decimal = Prisma.Decimal;
class StoreCustomerReturnService {
  /**
   * Create a customer return — items only (lot-based products).
   * Restocks the lot and records refund_amount.
   */  async createReturn(owner_id, payload) {
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

    // ── Pre-validation OUTSIDE the transaction ───────────────────────
    const salesItemIds = items.map((it) => String(it.sales_item_id || "").trim());

    if (salesItemIds.some((id) => !id)) {
      const e = new Error("sales_item_id is required for each item");
      e.status = 400;
      e.code = "VALIDATION_SALES_ITEM_ID_REQUIRED";
      throw e;
    }

    const [sale, refundAgg, salesItems] = await Promise.all([
      prisma.storeSales.findFirst({
        where: { sales_id, owner_id },
        select: { sales_id: true, total_amount: true, discount: true, paid_amount: true },
      }),
      prisma.storeCustomerReturn.aggregate({
        where: { sales_id },
        _sum: { refund_amount: true },
      }),
      prisma.storeSalesItem.findMany({
        where: { sales_item_id: { in: salesItemIds }, sales_id },
        select: {
          sales_item_id: true,
          lot_id: true,
          qty: true,
          returned_qty: true,
          sp: true,
          product: { select: { type: true, product_name: true } },
        },
      }),
    ]);

    if (!sale) {
      const e = new Error("Sale not found");
      e.status = 404;
      e.code = "SALE_NOT_FOUND";
      throw e;
    }

    const salesItemMap = new Map(salesItems.map((si) => [si.sales_item_id, si]));

    // Validate each item against the loaded sales items
    const validatedItems = [];
    for (const it of items) {
      const sales_item_id = String(it.sales_item_id).trim();
      const qty = Number(it.qty);

      const salesItem = salesItemMap.get(sales_item_id);
      if (!salesItem) {
        const e = new Error(`Sales item ${sales_item_id} not found`);
        e.status = 404;
        e.code = "SALES_ITEM_NOT_FOUND";
        throw e;
      }

      if (salesItem.product.type !== "item") {
        const e = new Error(
          `"${salesItem.product.product_name}" is a service and cannot be returned`,
        );
        e.status = 400;
        e.code = "SERVICE_NOT_RETURNABLE";
        throw e;
      }

      if (!salesItem.lot_id) {
        const e = new Error(`Sales item ${sales_item_id} has no associated lot`);
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

      validatedItems.push({
        sales_item_id,
        lot_id: salesItem.lot_id,
        qty,
        amount: Number(it.amount),
        note: it.note ?? null,
      });
    }

    const totalRefund = validatedItems.reduce((sum, it) => sum + it.amount, 0);

    // Recompute due_amount / payment_status on the sale in memory
    const previousRefunded = Number(refundAgg._sum.refund_amount || 0);
    const totalRefunded = new Decimal(previousRefunded).add(new Decimal(totalRefund));

    const effectiveTotal = new Decimal(sale.total_amount).sub(new Decimal(sale.discount ?? 0));
    const netTotal = effectiveTotal.sub(totalRefunded);
    const paidRaw = new Decimal(sale.paid_amount);
    const dueAmount = Decimal.max(new Decimal(0), netTotal.sub(paidRaw));

    const paymentStatus =
      paidRaw.gte(netTotal) && netTotal.gt(0) ? "paid" : paidRaw.gt(0) ? "partial" : "pending";

    // ── Transaction Batch ───────────────────────
    const return_id = uuidv4();
    const now = new Date();

    const returnHeaderPromise = prisma.storeCustomerReturn.create({
      data: {
        return_id,
        owner_id,
        sales_id,
        refund_amount: totalRefund,
        note: note ?? null,
        created_at: now,
      },
    });

    const itemsToCreate = [];
    const returnItemsPromises = validatedItems.map((it) => {
      const return_item_id = uuidv4();
      itemsToCreate.push({
        return_item_id,
        return_id,
        sales_item_id: it.sales_item_id,
        lot_id: it.lot_id,
        qty: it.qty,
        amount: it.amount,
        note: it.note,
        created_at: now,
      });
      return prisma.storeCustomerReturnItem.create({
        data: {
          return_item_id,
          owner_id,
          return_id,
          sales_item_id: it.sales_item_id,
          lot_id: it.lot_id,
          qty: it.qty,
          amount: it.amount,
          note: it.note,
          created_at: now,
        },
      });
    });

    const salesItemsUpdates = validatedItems.map((it) =>
      prisma.storeSalesItem.update({
        where: { sales_item_id: it.sales_item_id },
        data: { returned_qty: { increment: it.qty } },
      })
    );

    const lotUpdates = validatedItems.map((it) =>
      prisma.storeStockLot.update({
        where: { lot_id: it.lot_id },
        data: { qty_remaining: { increment: it.qty } },
      })
    );

    const salesHeaderUpdate = prisma.storeSales.update({
      where: { sales_id },
      data: { due_amount: dueAmount, payment_status: paymentStatus },
    });

    await prisma.$transaction([
      returnHeaderPromise,
      ...returnItemsPromises,
      ...salesItemsUpdates,
      ...lotUpdates,
      salesHeaderUpdate,
    ]);

    return {
      return: {
        return_id,
        sales_id,
        refund_amount: totalRefund,
        note: note ?? null,
        created_at: now,
        items: itemsToCreate,
      },
      sale_info: {
        sales_id,
        original_total: Number(sale.total_amount),
        original_paid: Number(sale.paid_amount),
        refund_amount: totalRefund,
        total_refunded: totalRefunded.toNumber(),
        due_amount: Number(dueAmount),
        payment_status: paymentStatus,
      },
    };
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
            due_amount: true,
            payment_status: true,
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

  async list(owner_id) {
    try {
      const rows = await prisma.$queryRaw`
        SELECT
          r.return_id,
          r.sales_id,
          r.refund_amount::numeric,
          r.note,
          r.created_at,
          CASE WHEN r.sales_id IS NOT NULL THEN json_build_object(
            'sales_id', s.sales_id,
            'total_amount', s.total_amount::numeric,
            'discount', s.discount::numeric,
            'paid_amount', s.paid_amount::numeric,
            'due_amount', s.due_amount::numeric,
            'payment_status', s.payment_status,
            'created_at', s.created_at,
            'customer', CASE WHEN s.customer_id IS NOT NULL THEN json_build_object(
              'customer_id', cust.customer_id,
              'full_name', cust.full_name,
              'phone', cust.phone
            ) ELSE NULL END
          ) ELSE NULL END AS sale,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'return_item_id', ri.return_item_id,
                  'sales_item_id', ri.sales_item_id,
                  'lot_id', ri.lot_id,
                  'qty', ri.qty,
                  'amount', ri.amount::numeric,
                  'note', ri.note,
                  'created_at', ri.created_at,
                  'cp', sl.cp::numeric,
                  'sp', sl.sp::numeric,
                  'product', json_build_object(
                    'product_id', p.product_id,
                    'product_name', p.product_name
                  )
                )
              )
              FROM store_customer_return_items ri
              LEFT JOIN store_stock_lots sl ON sl.lot_id = ri.lot_id
              LEFT JOIN store_products p ON p.product_id = sl.product_id
              WHERE ri.return_id = r.return_id
            ),
            '[]'::json
          ) AS items
        FROM store_customer_returns r
        LEFT JOIN store_sales s ON s.sales_id = r.sales_id
        LEFT JOIN customers cust ON cust.customer_id = s.customer_id
        WHERE r.owner_id = ${owner_id}
        ORDER BY r.created_at DESC
        LIMIT 100
      `;

      return rows.map((row) => ({
        return_id: row.return_id,
        sales_id: row.sales_id,
        refund_amount: Number(row.refund_amount || 0),
        note: row.note,
        created_at: row.created_at,
        return: {
          return_id: row.return_id,
          sales_id: row.sales_id,
          refund_amount: Number(row.refund_amount || 0),
          note: row.note,
          created_at: row.created_at,
        },
        sale: row.sale
          ? {
              sales_id: row.sale.sales_id,
              customer: row.sale.customer,
              total_amount: Number(row.sale.total_amount || 0),
              discount: Number(row.sale.discount || 0),
              paid_amount: Number(row.sale.paid_amount || 0),
              due_amount: Number(row.sale.due_amount || 0),
              payment_status: row.sale.payment_status,
              created_at: row.sale.created_at,
            }
          : null,
        items: (row.items || []).map((itm) => ({
          return_item_id: itm.return_item_id,
          sales_item_id: itm.sales_item_id,
          lot_id: itm.lot_id,
          qty: Number(itm.qty || 0),
          amount: Number(itm.amount || 0),
          note: itm.note,
          product: itm.product || null,
          cp: itm.cp ? Number(itm.cp) : null,
          sp: itm.sp ? Number(itm.sp) : null,
          created_at: itm.created_at,
        })),
      }));
    } catch (err) {
      console.error("Error in optimized storeCustomerReturnService.list:", err);
      throw err;
    }
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
            due_amount: Number(ret.sales.due_amount ?? 0),
            payment_status: ret.sales.payment_status,
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
