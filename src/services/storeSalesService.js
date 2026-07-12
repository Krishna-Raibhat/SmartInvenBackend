// src/services/storeSalesService.js
import { prisma } from "../prisma/client.js";
import { normalizeNepalPhone, isValidNepalPhone } from "../utils/phone.js";
import { Prisma } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const Decimal = Prisma.Decimal;

class StoreSalesService {
  async createSale(owner_id, payload) {
    const {
      customer_id,
      customer,
      paid_amount,
      payment_status,
      note,
      discount,
      items,
      payment_method,
    } = payload;

    const validMethods = ["cash", "online"];
    if (payment_method && !validMethods.includes(payment_method)) {
      const e = new Error("payment_method must be cash or online");
      e.status = 400;
      e.code = "VALIDATION_PAYMENT_METHOD_INVALID";
      throw e;
    }
    const finalPaymentMethod = payment_method ?? "cash";

    if (!Array.isArray(items) || items.length === 0) {
      const e = new Error("At least one item is required");
      e.status = 400;
      e.code = "VALIDATION_NO_ITEMS";
      throw e;
    }

    const paid = new Decimal(Number(paid_amount ?? 0));
    if (paid.lt(0)) {
      const e = new Error("paid_amount must be a valid non-negative number");
      e.status = 400;
      e.code = "VALIDATION_PAID_INVALID";
      throw e;
    }

    const disc = new Decimal(Number(discount ?? 0));
    if (disc.lt(0)) {
      const e = new Error("discount must be a valid number >= 0");
      e.status = 400;
      e.code = "VALIDATION_DISCOUNT_INVALID";
      throw e;
    }

    // Resolve customer
    let finalCustomerId = customer_id ?? null;
    let customerPhone = null;

    // Prefetch all products, lots, and resolved customer in parallel to avoid sequential queries
    const productIds = [...new Set(items.map(item => item.product_id).filter(Boolean))];
    const lotIds = [...new Set(items.map(item => item.lot_id).filter(Boolean))];

    const promises = [
      prisma.storeProduct.findMany({
        where: { product_id: { in: productIds }, owner_id },
        select: { product_id: true, type: true, cp: true, sp: true },
      }),
      lotIds.length > 0
        ? prisma.storeStockLot.findMany({
            where: { lot_id: { in: lotIds }, owner_id },
            select: { lot_id: true, product_id: true, cp: true, sp: true, qty_remaining: true },
          })
        : Promise.resolve([]),
      prisma.storeStockLot.findMany({
        where: { product_id: { in: productIds }, owner_id, qty_remaining: { gt: 0 } },
        orderBy: { created_at: "asc" },
        select: { lot_id: true, product_id: true, cp: true, sp: true, qty_remaining: true },
      }),
    ];

    if (finalCustomerId) {
      promises.push(
        prisma.customer.findFirst({
          where: { customer_id: finalCustomerId, owner_id },
          select: { customer_id: true },
        })
      );
    } else if (customer?.phone) {
      customerPhone = normalizeNepalPhone(String(customer.phone).trim());
      if (!isValidNepalPhone(customerPhone)) {
        const e = new Error(
          "Invalid phone number. Please enter a valid 10-digit Nepali number.",
        );
        e.status = 400;
        e.code = "VALIDATION_PHONE_INVALID";
        throw e;
      }
      promises.push(
        prisma.customer.findFirst({
          where: { owner_id, phone: customerPhone },
          select: { customer_id: true },
        })
      );
    }

    const results = await Promise.all(promises);
    const prefetchedProducts = results[0];
    const prefetchedLots = results[1];
    const autoSelectedLots = results[2];
    const resolvedCustomer = results[3];

    if (finalCustomerId) {
      if (!resolvedCustomer) {
        const e = new Error("Customer not found for this owner");
        e.status = 404;
        e.code = "CUSTOMER_NOT_FOUND";
        throw e;
      }
    } else if (customer?.phone) {
      if (resolvedCustomer) {
        finalCustomerId = resolvedCustomer.customer_id;
      } else {
        const created = await prisma.customer.create({
          data: {
            owner_id,
            full_name: String(customer.full_name || "Walk-in Customer").trim(),
            phone: customerPhone,
            email: customer.email ? String(customer.email).trim() : null,
            address: customer.address ? String(customer.address).trim() : null,
          },
          select: { customer_id: true },
        });
        finalCustomerId = created.customer_id;
      }
    }

    const productMap = new Map(prefetchedProducts.map(p => [p.product_id, p]));
    const lotMap = new Map(prefetchedLots.map(l => [l.lot_id, l]));

    const autoLotsMap = new Map();
    for (const lot of autoSelectedLots) {
      if (!autoLotsMap.has(lot.product_id)) {
        autoLotsMap.set(lot.product_id, []);
      }
      autoLotsMap.get(lot.product_id).push(lot);
    }

    // --- PRE-CALCULATIONS & WRITES DATA BUILD ---
    const sales_id = uuidv4();
    let totalAmount = new Decimal(0);
    const lotUpdatesMap = new Map();
    const itemsToCreate = [];

    for (const item of items) {
      const { product_id, lot_id, qty, sp: itemSp, note: lineNote } = item;

      if (!product_id) {
        const e = new Error("product_id is required for each item");
        e.status = 400;
        e.code = "VALIDATION_PRODUCT_REQUIRED";
        throw e;
      }

      const qtyNum = Number(qty);
      if (!Number.isInteger(qtyNum) || qtyNum <= 0) {
        const e = new Error("qty must be a positive integer");
        e.status = 400;
        e.code = "VALIDATION_QTY_INVALID";
        throw e;
      }

      const product = productMap.get(product_id);
      if (!product) {
        const e = new Error(`Product ${product_id} not found`);
        e.status = 404;
        e.code = "PRODUCT_NOT_FOUND";
        throw e;
      }

      if (product.type === "item") {
        if (lot_id) {
          const lot = lotMap.get(lot_id);
          if (!lot || lot.product_id !== product_id) {
            const e = new Error(`Stock lot ${lot_id} not found for this product`);
            e.status = 404;
            e.code = "LOT_NOT_FOUND";
            throw e;
          }

          if (lot.qty_remaining < qtyNum) {
            const e = new Error(
              `Not enough stock in lot ${lot_id}. Available: ${lot.qty_remaining}, Requested: ${qtyNum}`,
            );
            e.status = 400;
            e.code = "STOCK_NOT_ENOUGH";
            throw e;
          }

          lot.qty_remaining -= qtyNum;
          lotUpdatesMap.set(lot_id, (lotUpdatesMap.get(lot_id) || 0) + qtyNum);

          const sellingPrice = new Decimal(itemSp ?? lot.sp);
          if (sellingPrice.lt(0)) {
            const e = new Error("sp must be >= 0");
            e.status = 400;
            e.code = "VALIDATION_SP_INVALID";
            throw e;
          }

          const lineTotal = sellingPrice.mul(qtyNum);
          totalAmount = totalAmount.add(lineTotal);

          itemsToCreate.push({
            sales_item_id: uuidv4(),
            owner_id,
            sales_id,
            product_id,
            lot_id,
            qty: qtyNum,
            cp: lot.cp,
            sp: sellingPrice,
            line_total: lineTotal,
            note: lineNote ?? null,
            created_at: new Date(),
            returned_qty: 0,
          });
        } else {
          const lots = autoLotsMap.get(product_id) || [];
          const availableLots = lots.filter(l => l.qty_remaining > 0);

          if (availableLots.length === 0) {
            const e = new Error(`No stock available for product ${product_id}`);
            e.status = 400;
            e.code = "NO_STOCK_AVAILABLE";
            throw e;
          }

          let remaining = qtyNum;

          for (const lot of availableLots) {
            if (remaining <= 0) break;

            const deduct = Math.min(remaining, lot.qty_remaining);
            lot.qty_remaining -= deduct;
            lotUpdatesMap.set(lot.lot_id, (lotUpdatesMap.get(lot.lot_id) || 0) + deduct);

            const sellingPrice = new Decimal(itemSp ?? lot.sp);
            if (sellingPrice.lt(0)) {
              const e = new Error("sp must be >= 0");
              e.status = 400;
              e.code = "VALIDATION_SP_INVALID";
              throw e;
            }

            const lineTotal = sellingPrice.mul(deduct);
            totalAmount = totalAmount.add(lineTotal);

            itemsToCreate.push({
              sales_item_id: uuidv4(),
              owner_id,
              sales_id,
              product_id,
              lot_id: lot.lot_id,
              qty: deduct,
              cp: lot.cp,
              sp: sellingPrice,
              line_total: lineTotal,
              note: lineNote ?? null,
              created_at: new Date(),
              returned_qty: 0,
            });

            remaining -= deduct;
          }

          if (remaining > 0) {
            const e = new Error(
              `Not enough stock for product ${product_id}. Short by ${remaining} unit(s)`,
            );
            e.status = 400;
            e.code = "STOCK_NOT_ENOUGH";
            throw e;
          }
        }
      } else {
        const sellingPrice = new Decimal(itemSp ?? product.sp ?? 0);
        if (sellingPrice.lte(0)) {
          const e = new Error(`sp is required and must be > 0 for service product ${product_id}`);
          e.status = 400;
          e.code = "VALIDATION_SP_REQUIRED";
          throw e;
        }

        const lineTotal = sellingPrice.mul(qtyNum);
        totalAmount = totalAmount.add(lineTotal);

        itemsToCreate.push({
          sales_item_id: uuidv4(),
          owner_id,
          sales_id,
          product_id,
          lot_id: null,
          qty: qtyNum,
          cp: product.cp ?? null,
          sp: sellingPrice,
          line_total: lineTotal,
          note: lineNote ?? null,
          created_at: new Date(),
          returned_qty: 0,
        });
      }
    }

    if (disc.gt(totalAmount)) {
      const e = new Error("Discount cannot exceed total amount");
      e.status = 400;
      e.code = "VALIDATION_DISCOUNT_EXCEEDS_TOTAL";
      throw e;
    }

    const effectiveTotal = totalAmount.sub(disc);

    let finalStatus;
    if (paid.gte(effectiveTotal) && effectiveTotal.gt(0)) {
      finalStatus = "paid";
    } else if (paid.gt(0)) {
      finalStatus = "partial";
    } else {
      finalStatus = "pending";
    }

    if (payment_status === "paid" && paid.lt(effectiveTotal)) {
      const e = new Error("Cannot mark as paid when paid_amount is less than total");
      e.status = 400;
      e.code = "VALIDATION_STATUS_INCONSISTENT";
      throw e;
    }
    if (payment_status === "partial" && paid.lte(0)) {
      const e = new Error("Cannot mark as partial when paid_amount is 0");
      e.status = 400;
      e.code = "VALIDATION_STATUS_INCONSISTENT";
      throw e;
    }

    const dueAmount = Decimal.max(new Decimal(0), effectiveTotal.sub(paid));

    // --- TRANSACTION BATCH (Interactive Transaction for Single Bulk Updates) ---
    const createdHeader = await prisma.$transaction(async (tx) => {
      const salesHeader = await tx.storeSales.create({
        data: {
          sales_id,
          owner_id,
          customer_id: finalCustomerId,
          total_amount: totalAmount,
          discount: disc,
          paid_amount: paid,
          due_amount: dueAmount,
          payment_status: finalStatus,
          payment_method: finalPaymentMethod,
          note: note ?? null,
        },
      });

      if (lotUpdatesMap.size > 0) {
        const updatesList = Array.from(lotUpdatesMap.entries()).map(([lot_id, decrement]) => ({ lot_id, decrement }));
        const valuesSql = updatesList.map((_, i) => `($${i * 2 + 1}::text, $${i * 2 + 2}::integer)`).join(", ");
        const valuesArgs = updatesList.flatMap(u => [u.lot_id, u.decrement]);
        
        await tx.$executeRawUnsafe(
          `UPDATE store_stock_lots AS sl
           SET qty_remaining = sl.qty_remaining - tmp.decrement_qty
           FROM (VALUES ${valuesSql}) AS tmp(lot_id, decrement_qty)
           WHERE sl.lot_id = tmp.lot_id`,
          ...valuesArgs
        );
      }

      await tx.storeSalesItem.createMany({ data: itemsToCreate });

      return salesHeader;
    });

    return { ...createdHeader, items: itemsToCreate };
  }

  async list(owner_id, { page = 1, limit = 50 } = {}) {
    try {
      const page_num = Number(page);
      const limit_num = Number(limit);
      const skip = (page_num - 1) * limit_num;

      const rows = await prisma.$queryRaw`
        SELECT
          s.sales_id,
          s.payment_status,
          s.payment_method,
          s.total_amount::numeric,
          s.discount::numeric,
          s.paid_amount::numeric,
          s.due_amount::numeric,
          s.note,
          s.created_at,
          s.updated_at,
          s.customer_id,
          CASE WHEN s.customer_id IS NOT NULL THEN json_build_object(
            'customer_id', c.customer_id,
            'full_name', c.full_name,
            'phone', c.phone
          ) ELSE NULL END AS customer,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'sales_item_id', si.sales_item_id,
                  'product_id', si.product_id,
                  'lot_id', si.lot_id,
                  'qty', si.qty,
                  'cp', si.cp::numeric,
                  'sp', si.sp::numeric,
                  'line_total', si.line_total::numeric,
                  'note', si.note,
                  'created_at', si.created_at,
                  'returned_qty', si.returned_qty,
                  'product', json_build_object(
                    'product_name', p.product_name,
                    'type', p.type::text
                  )
                )
              )
              FROM store_sales_items si
              LEFT JOIN store_products p ON p.product_id = si.product_id
              WHERE si.sales_id = s.sales_id
            ),
            '[]'::json
          ) AS items,
          COUNT(*) OVER()::int AS full_count
        FROM store_sales s
        LEFT JOIN customers c ON c.customer_id = s.customer_id
        WHERE s.owner_id = ${owner_id}
        ORDER BY s.created_at DESC
        LIMIT ${limit_num}
        OFFSET ${skip}
      `;

      const total = rows[0]?.full_count ?? 0;
      const data = rows.map((row) => ({
        sales_id: row.sales_id,
        owner_id,
        customer_id: row.customer_id,
        total_amount: Number(row.total_amount || 0),
        discount: Number(row.discount || 0),
        paid_amount: Number(row.paid_amount || 0),
        note: row.note,
        created_at: row.created_at,
        updated_at: row.updated_at,
        payment_status: row.payment_status,
        due_amount: Number(row.due_amount || 0),
        payment_method: row.payment_method,
        customer: row.customer,
        items: (row.items || []).map((itm) => ({
          sales_item_id: itm.sales_item_id,
          sales_id: row.sales_id,
          product_id: itm.product_id,
          lot_id: itm.lot_id,
          qty: itm.qty,
          cp: itm.cp ? Number(itm.cp) : null,
          sp: Number(itm.sp || 0),
          line_total: Number(itm.line_total || 0),
          note: itm.note,
          created_at: itm.created_at,
          owner_id: owner_id,
          returned_qty: Number(itm.returned_qty || 0),
          product: itm.product || null,
        })),
      }));

      return { data, total, page: page_num, limit: limit_num, totalPages: Math.ceil(total / limit_num) };
    } catch (err) {
      console.error("Error in optimized storeSalesService.list:", err);
      throw err;
    }
  }
  
  async listCredit(owner_id, { page = 1, limit = 50 } = {}) {
    const page_num = Number(page);
    const limit_num = Number(limit);
    const skip = (page_num - 1) * limit_num;

    const rows = await prisma.$queryRaw`
      WITH refunds AS (
        SELECT sales_id, COALESCE(SUM(refund_amount), 0)::numeric AS total_refunded
        FROM store_customer_returns
        GROUP BY sales_id
      ),
      computed AS (
        SELECT
          ss.sales_id, ss.payment_status, ss.payment_method,
          ss.total_amount, ss.discount, ss.paid_amount AS paid_raw,
          ss.created_at, ss.customer_id, c.full_name, c.phone,
          COALESCE(r.total_refunded, 0)::numeric AS total_refunded,
          GREATEST(ss.total_amount - COALESCE(ss.discount, 0), 0) AS effective_total
        FROM store_sales ss
        LEFT JOIN refunds r ON r.sales_id = ss.sales_id
        LEFT JOIN customers c ON c.customer_id = ss.customer_id
        WHERE ss.owner_id = ${owner_id}
      ),
      final AS (
        SELECT
          sales_id, payment_status, payment_method, total_amount, discount,
          created_at, customer_id, full_name, phone, total_refunded,
          GREATEST(0, effective_total - paid_raw - total_refunded)::numeric AS due_amount,
          GREATEST(0, paid_raw - GREATEST(0, total_refunded - GREATEST(0, effective_total - paid_raw)))::numeric AS net_paid
        FROM computed
      )
      SELECT *, COUNT(*) OVER()::int AS full_count
      FROM final
      WHERE due_amount > 0
      ORDER BY created_at DESC
      LIMIT ${limit_num}
      OFFSET ${skip};
    `;

    const total = rows[0]?.full_count ?? 0;

    const data = rows.map((row) => ({
      sales_id:       row.sales_id,
      payment_status: row.payment_status,
      payment_method: row.payment_method,
      total_amount:   Number(row.total_amount),
      discount:       Number(row.discount),
      created_at:     row.created_at,
      customer: row.customer_id
        ? { customer_id: row.customer_id, full_name: row.full_name, phone: row.phone }
        : null,
      paid_amount:    Number(row.net_paid),
      due_amount:     Number(row.due_amount),
      total_refunded: Number(row.total_refunded),
    }));

    return { data, total, page: page_num, limit: limit_num, totalPages: Math.ceil(total / limit_num) };
  }

  async getById(owner_id, sales_id) {
    try {
      const rows = await prisma.$queryRaw`
        SELECT
          s.sales_id,
          s.payment_status,
          s.payment_method,
          s.total_amount::numeric,
          s.discount::numeric,
          s.paid_amount::numeric,
          s.due_amount::numeric,
          s.note,
          s.created_at,
          s.updated_at,
          s.customer_id,
          CASE WHEN s.customer_id IS NOT NULL THEN json_build_object(
            'customer_id', c.customer_id,
            'full_name', c.full_name,
            'phone', c.phone,
            'email', c.email,
            'address', c.address
          ) ELSE NULL END AS customer,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'sales_item_id', si.sales_item_id,
                  'product_id', si.product_id,
                  'lot_id', si.lot_id,
                  'qty', si.qty,
                  'cp', si.cp::numeric,
                  'sp', si.sp::numeric,
                  'line_total', si.line_total::numeric,
                  'note', si.note,
                  'created_at', si.created_at,
                  'returned_qty', si.returned_qty,
                  'product', json_build_object(
                    'product_name', p.product_name,
                    'type', p.type::text,
                    'unit', CASE WHEN p.unit_id IS NOT NULL THEN json_build_object('unit_name', u.unit_name) ELSE NULL END
                  ),
                  'lot', CASE WHEN si.lot_id IS NOT NULL THEN json_build_object(
                    'lot_id', sl.lot_id,
                    'notes', sl.notes,
                    'supplier', CASE WHEN sl.supplier_id IS NOT NULL THEN json_build_object('supplier_name', sup.supplier_name) ELSE NULL END
                  ) ELSE NULL END
                ) ORDER BY si.created_at ASC
              )
              FROM store_sales_items si
              LEFT JOIN store_products p ON p.product_id = si.product_id
              LEFT JOIN store_units u ON u.unit_id = p.unit_id
              LEFT JOIN store_stock_lots sl ON sl.lot_id = si.lot_id
              LEFT JOIN store_suppliers sup ON sup.supplier_id = sl.supplier_id
              WHERE si.sales_id = s.sales_id
            ),
            '[]'::json
          ) AS items
        FROM store_sales s
        LEFT JOIN customers c ON c.customer_id = s.customer_id
        WHERE s.sales_id = ${sales_id} AND s.owner_id = ${owner_id}
        LIMIT 1
      `;

      const row = rows[0];
      if (!row) {
        const e = new Error("Sale not found");
        e.status = 404;
        e.code = "SALE_NOT_FOUND";
        throw e;
      }

      return {
        sales_id: row.sales_id,
        owner_id,
        customer_id: row.customer_id,
        total_amount: Number(row.total_amount || 0),
        discount: Number(row.discount || 0),
        paid_amount: Number(row.paid_amount || 0),
        due_amount: Number(row.due_amount || 0),
        note: row.note,
        created_at: row.created_at,
        updated_at: row.updated_at,
        payment_status: row.payment_status,
        payment_method: row.payment_method,
        customer: row.customer,
        items: (row.items || []).map((itm) => ({
          sales_item_id: itm.sales_item_id,
          sales_id: row.sales_id,
          product_id: itm.product_id,
          lot_id: itm.lot_id,
          qty: itm.qty,
          cp: itm.cp ? Number(itm.cp) : null,
          sp: Number(itm.sp || 0),
          line_total: Number(itm.line_total || 0),
          note: itm.note,
          created_at: itm.created_at,
          owner_id: owner_id,
          returned_qty: Number(itm.returned_qty || 0),
          product: itm.product,
          lot: itm.lot,
        })),
      };
    } catch (err) {
      console.error("Error in optimized storeSalesService.getById:", err);
      throw err;
    }
  }

 
  async addPayment(owner_id, sales_id, add_amount, payment_method) {
    const validMethods = ["cash", "online"];
    if (payment_method && !validMethods.includes(payment_method)) {
      const e = new Error("payment_method must be cash or online");
      e.status = 400;
      e.code = "VALIDATION_PAYMENT_METHOD_INVALID";
      throw e;
    }

    const add = new Decimal(Number(add_amount));
    if (add.lte(0)) {
      const e = new Error("amount must be a positive number");
      e.status = 400;
      e.code = "VALIDATION_AMOUNT_INVALID";
      throw e;
    }

    return prisma.$transaction(async (tx) => {
      const sale = await tx.storeSales.findFirst({
        where: { owner_id, sales_id },
        select: {
          sales_id: true,
          total_amount: true,
          discount: true,
          paid_amount: true,
        },
      });

      if (!sale) {
        const e = new Error("Sale not found");
        e.status = 404;
        e.code = "SALE_NOT_FOUND";
        throw e;
      }

      // Fetch total refunds for this sale
      const refundAgg = await tx.storeCustomerReturn.aggregate({
        where: { sales_id },
        _sum: { refund_amount: true },
      });
      const totalRefunded = Number(refundAgg._sum.refund_amount || 0);

      const effectiveTotal =
        Number(sale.total_amount) - Number(sale.discount ?? 0);
      const currentPaid = Number(sale.paid_amount);

      // Real due = effectiveTotal - refunds - currentPaid
      const realDue = Math.max(0, effectiveTotal - totalRefunded - currentPaid);

      if (add.gt(new Decimal(realDue).add(new Decimal("0.01")))) {
        const e = new Error(
          `Payment exceeds remaining due of ${realDue.toFixed(2)}`
        );
        e.status = 400;
        e.code = "PAYMENT_EXCEEDS_TOTAL";
        throw e;
      }

      const finalPaid = new Decimal(currentPaid).add(add);
      const netTotal = new Decimal(effectiveTotal).sub(new Decimal(totalRefunded));
      const finalDue = Decimal.max(new Decimal(0), netTotal.sub(finalPaid));

      const status =
        finalPaid.gte(netTotal) && netTotal.gt(0)
          ? "paid"
          : finalPaid.gt(0)
          ? "partial"
          : "pending";

      const updateData = {
        paid_amount: finalPaid,
        due_amount: finalDue,
        payment_status: status,
      };
      if (payment_method) updateData.payment_method = payment_method;

      return tx.storeSales.update({
        where: { sales_id },
        data: updateData,
      });
    });
  }

  
}

export default new StoreSalesService();
