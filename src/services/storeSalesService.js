// src/services/storeSalesService.js
import { prisma } from "../prisma/client.js";
import { normalizeNepalPhone, isValidNepalPhone } from "../utils/phone.js";
import { Prisma } from "@prisma/client";

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
        const e = new Error(
          "Invalid phone number. Please enter a valid 10-digit Nepali number.",
        );
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
    }

    return prisma.$transaction(async (tx) => {
      const header = await tx.storeSales.create({
        data: {
          owner_id,
          customer_id: finalCustomerId,
          payment_status: "pending",
          payment_method: finalPaymentMethod,
          total_amount: 0,
          discount: disc,
          paid_amount: paid,
          note: note ?? null,
        },
      });

      let totalAmount = new Decimal(0);
      const createdItems = [];

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

        const product = await tx.storeProduct.findFirst({
          where: { product_id, owner_id },
          select: { product_id: true, type: true, cp: true, sp: true },
        });

        if (!product) {
          const e = new Error(`Product ${product_id} not found`);
          e.status = 404;
          e.code = "PRODUCT_NOT_FOUND";
          throw e;
        }

        if (product.type === "item") {
          if (lot_id) {
            const lot = await tx.storeStockLot.findFirst({
              where: { lot_id, product_id, owner_id },
              select: { lot_id: true, cp: true, sp: true, qty_remaining: true },
            });

            if (!lot) {
              const e = new Error(
                `Stock lot ${lot_id} not found for this product`,
              );
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

            await tx.storeStockLot.update({
              where: { lot_id },
              data: { qty_remaining: { decrement: qtyNum } },
            });

            const sellingPrice = new Decimal(itemSp ?? lot.sp);
            if (sellingPrice.lt(0)) {
              const e = new Error("sp must be >= 0");
              e.status = 400;
              e.code = "VALIDATION_SP_INVALID";
              throw e;
            }

            const lineTotal = sellingPrice.mul(qtyNum);
            totalAmount = totalAmount.add(lineTotal);

            createdItems.push(
              await tx.storeSalesItem.create({
                data: {
                  owner_id,
                  sales_id: header.sales_id,
                  product_id,
                  lot_id,
                  qty: qtyNum,
                  cp: lot.cp,
                  sp: sellingPrice,
                  line_total: lineTotal,
                  note: lineNote ?? null,
                },
              }),
            );
          } else {
            const lots = await tx.storeStockLot.findMany({
              where: { owner_id, product_id, qty_remaining: { gt: 0 } },
              orderBy: { created_at: "asc" },
              select: { lot_id: true, cp: true, sp: true, qty_remaining: true },
            });

            if (lots.length === 0) {
              const e = new Error(
                `No stock available for product ${product_id}`,
              );
              e.status = 400;
              e.code = "NO_STOCK_AVAILABLE";
              throw e;
            }

            let remaining = qtyNum;

            for (const lot of lots) {
              if (remaining <= 0) break;

              const deduct = Math.min(remaining, lot.qty_remaining);

              await tx.storeStockLot.update({
                where: { lot_id: lot.lot_id },
                data: { qty_remaining: { decrement: deduct } },
              });

              const sellingPrice = new Decimal(itemSp ?? lot.sp);
              if (sellingPrice.lt(0)) {
                const e = new Error("sp must be >= 0");
                e.status = 400;
                e.code = "VALIDATION_SP_INVALID";
                throw e;
              }

              const lineTotal = sellingPrice.mul(deduct);
              totalAmount = totalAmount.add(lineTotal);

              createdItems.push(
                await tx.storeSalesItem.create({
                  data: {
                    owner_id,
                    sales_id: header.sales_id,
                    product_id,
                    lot_id: lot.lot_id,
                    qty: deduct,
                    cp: lot.cp,
                    sp: sellingPrice,
                    line_total: lineTotal,
                    note: lineNote ?? null,
                  },
                }),
              );

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
            const e = new Error(
              `sp is required and must be > 0 for service product ${product_id}`,
            );
            e.status = 400;
            e.code = "VALIDATION_SP_REQUIRED";
            throw e;
          }

          const lineTotal = sellingPrice.mul(qtyNum);
          totalAmount = totalAmount.add(lineTotal);

          createdItems.push(
            await tx.storeSalesItem.create({
              data: {
                owner_id,
                sales_id: header.sales_id,
                product_id,
                lot_id: null,
                qty: qtyNum,
                cp: product.cp ?? null,
                sp: sellingPrice,
                line_total: lineTotal,
                note: lineNote ?? null,
              },
            }),
          );
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
        const e = new Error(
          "Cannot mark as paid when paid_amount is less than total",
        );
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

      const updatedHeader = await tx.storeSales.update({
        where: { sales_id: header.sales_id },
        data: {
          total_amount: totalAmount,
          discount: disc,
          paid_amount: paid,
          due_amount: dueAmount,
          payment_status: finalStatus,
          payment_method: finalPaymentMethod,
        },
      });

      return { ...updatedHeader, items: createdItems };
    });
  }

  async list(owner_id, { page = 1, limit = 50 } = {}) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.storeSales.findMany({
        where: { owner_id },
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
        include: {
          customer: {
            select: { customer_id: true, full_name: true, phone: true },
          },
          items: {
            select: {
              qty: true,
              sp: true,
              line_total: true,
              product: { select: { product_name: true, type: true } },
            },
          },
        },
      }),
      prisma.storeSales.count({ where: { owner_id } }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
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
    const sale = await prisma.storeSales.findFirst({
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
        // items: {
        //   orderBy: { created_at: "asc" },
        //   include: {
        //     product: {
        //       select: {
        //         product_name: true,
        //         type: true,
        //         unit: { select: { unit_name: true } },
        //       },
        //     },
        //     lot: {
        //       select: { lot_id: true, notes: true },
        //     },
        //   },
        // },
        items: {
          orderBy: { created_at: "asc" },
          include: {
            product: {
              select: {
                product_name: true,
                type: true,
                unit: {
                  select: {
                    unit_name: true,
                  },
                },
              },
            },
            lot: {
              select: {
                lot_id: true,
                notes: true,
                supplier: {
                  select: {
                    supplier_name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!sale) {
      const e = new Error("Sale not found");
      e.status = 404;
      e.code = "SALE_NOT_FOUND";
      throw e;
    }

    return sale;
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
