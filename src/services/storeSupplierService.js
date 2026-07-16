// src/services/storeSupplierService.js
import { prisma } from "../prisma/client.js";
import { Prisma } from "@prisma/client";

class StoreSupplierService {
  async create({ owner_id, supplier_name, phone, email, address }) {
    try {
      return await prisma.storeSupplier.create({
        data: {
          owner_id,
          supplier_name: supplier_name.trim(),
          phone: phone.trim(),
          email: email?.trim() || null,
          address: address?.trim() || null,
        },
      });
    } catch (err) {
      if (err.code === "P2002") {
        throw {
          code: "DUPLICATE",
          message: "Supplier with this phone already exists.",
        };
      }
      throw err;
    }
  }

  async list(owner_id) {
    const suppliers = await prisma.storeSupplier.findMany({
      where: { owner_id },
      orderBy: { created_at: "desc" },
    });

    if (suppliers.length === 0) return [];

    // Get total qty_in and last purchase date per supplier in one query
    const supplierIds = suppliers.map((s) => s.supplier_id);

    const lotStats = await prisma.storeStockLot.groupBy({
      by: ["supplier_id"],
      where: { owner_id, supplier_id: { in: supplierIds } },
      _sum: { qty_in: true },
      _max: { created_at: true },
    });

    // Map stats by supplier_id for fast lookup
    const statsMap = {};
    for (const stat of lotStats) {
      statsMap[stat.supplier_id] = {
        total_qty_purchased: stat._sum.qty_in ?? 0,
        last_purchased_at: stat._max.created_at ?? null,
      };
    }

    return suppliers.map((s) => ({
      ...s,
      total_qty_purchased: statsMap[s.supplier_id]?.total_qty_purchased ?? 0,
      last_purchased_at: statsMap[s.supplier_id]?.last_purchased_at ?? null,
    }));
  }

  async getById(owner_id, supplier_id) {
    const supplier = await prisma.storeSupplier.findFirst({
      where: { owner_id, supplier_id },
    });

    if (!supplier) {
      throw { code: "NOT_FOUND", message: "Supplier not found." };
    }

    // Aggregate stock lot stats for this supplier
    const lotStats = await prisma.storeStockLot.aggregate({
      where: { owner_id, supplier_id },
      _count: { lot_id: true },
      _sum: { qty_in: true, qty_remaining: true },
    });

    // Fetch supplier returns to adjust stats
    const [returnsAgg, returnItems] = await Promise.all([
      prisma.storeSupplierReturn.aggregate({
        where: { owner_id, supplier_id },
        _sum: { total_refund: true },
      }),
      prisma.storeSupplierReturnItem.aggregate({
        where: { owner_id, return: { supplier_id } },
        _sum: { qty: true },
      }),
    ]);

    // Total purchased amount = sum of (cp × qty_in) across all lots
    const lots = await prisma.storeStockLot.findMany({
      where: { owner_id, supplier_id },
      select: { cp: true, qty_in: true },
    });

    const grossPurchasedAmount = lots.reduce((acc, lot) => {
      return acc.add(new Prisma.Decimal(lot.cp).mul(lot.qty_in));
    }, new Prisma.Decimal(0));

    const totalRefund = new Prisma.Decimal(returnsAgg._sum.total_refund ?? 0);
    const totalPurchasedAmount = grossPurchasedAmount.minus(totalRefund);

    const grossQtyPurchased = lotStats._sum.qty_in ?? 0;
    const returnedQty = returnItems._sum.qty ?? 0;
    const totalQtyPurchased = grossQtyPurchased - returnedQty;

    return {
      ...supplier,
      stats: {
        total_stock_lots: lotStats._count.lot_id,
        total_qty_purchased: totalQtyPurchased,
        total_qty_remaining: lotStats._sum.qty_remaining ?? 0,
        total_purchased_amount: totalPurchasedAmount,
      },
    };
  }

  async update(owner_id, supplier_id, data) {
    const existing = await prisma.storeSupplier.findFirst({
      where: { owner_id, supplier_id },
      select: { supplier_id: true },
    });

    if (!existing) {
      throw { code: "NOT_FOUND", message: "Supplier not found." };
    }

    const updateData = {};
    if (data.supplier_name)
      updateData.supplier_name = data.supplier_name.trim();
    if (data.phone) updateData.phone = data.phone.trim();
    if (data.email !== undefined) updateData.email = data.email?.trim() || null;
    if (data.address !== undefined)
      updateData.address = data.address?.trim() || null;

    try {
      return await prisma.storeSupplier.update({
        where: { supplier_id },
        data: updateData,
      });
    } catch (err) {
      if (err.code === "P2002") {
        throw {
          code: "DUPLICATE",
          message: "Supplier with this phone already exists.",
        };
      }
      throw err;
    }
  }

  async getLots(owner_id, supplier_id) {
    try {
      const rows = await prisma.$queryRaw`
        SELECT 
          sl.lot_id,
          sl.cp::numeric,
          sl.sp::numeric,
          sl.qty_in,
          sl.qty_remaining,
          sl.notes,
          sl.created_at,
          sl.updated_at,
          p.product_id,
          p.product_name,
          p.type::text AS product_type,
          c.category_id,
          c.category_name,
          u.unit_id,
          u.unit_name,
          COALESCE(
            (
              SELECT SUM(sri.qty)::int
              FROM store_supplier_return_items sri
              WHERE sri.lot_id = sl.lot_id
            ),
            0
          ) AS qty_returned
        FROM store_suppliers sup
        LEFT JOIN store_stock_lots sl ON sl.supplier_id = sup.supplier_id
        LEFT JOIN store_products p ON p.product_id = sl.product_id
        LEFT JOIN store_categories c ON c.category_id = p.category_id
        LEFT JOIN store_units u ON u.unit_id = p.unit_id
        WHERE sup.supplier_id = ${supplier_id} AND sup.owner_id = ${owner_id}
        ORDER BY sl.created_at DESC
      `;

      if (rows.length === 0) {
        throw {
          code: "NOT_FOUND",
          message: "Supplier not found.",
        };
      }

      if (rows.length === 1 && rows[0].lot_id === null) {
        return [];
      }

      return rows.map((r) => ({
        lot_id: r.lot_id,
        owner_id,
        product_id: r.product_id,
        supplier_id,
        cp: Number(r.cp || 0),
        sp: Number(r.sp || 0),
        qty_in: Number(r.qty_in || 0),
        qty_remaining: Number(r.qty_remaining || 0),
        notes: r.notes,
        created_at: r.created_at,
        updated_at: r.updated_at,
        product: {
          product_id: r.product_id,
          product_name: r.product_name,
          type: r.product_type,
          category: r.category_id ? { category_id: r.category_id, category_name: r.category_name } : null,
          unit: r.unit_id ? { unit_id: r.unit_id, unit_name: r.unit_name } : null,
        },
        qty_returned: Number(r.qty_returned || 0),
      }));
    } catch (err) {
      console.error("Error in optimized storeSupplierService.getLots:", err);
      throw err;
    }
  }

  /**
   * User manually sets the due amount.
   * Recalculates status based on current paid_amount vs new due.
   */
  async setDue(owner_id, supplier_id, due_amount) {
    const supplier = await prisma.storeSupplier.findFirst({
      where: { owner_id, supplier_id },
    });

    if (!supplier) {
      throw { code: "NOT_FOUND", message: "Supplier not found." };
    }

    const newDue = new Prisma.Decimal(due_amount);
    if (newDue.lt(0)) {
      throw {
        code: "INVALID_AMOUNT",
        message: "due_amount cannot be negative.",
      };
    }

    const paidAmount = new Prisma.Decimal(supplier.paid_amount);

    let payment_status;
    if (newDue.eq(0)) {
      payment_status = "paid";
    } else if (paidAmount.eq(0)) {
      payment_status = "unpaid";
    } else {
      payment_status = "partial";
    }

    return prisma.storeSupplier.update({
      where: { supplier_id },
      data: { due_amount: newDue, payment_status },
    });
  }

  /**
   * User enters a payment amount against the supplier's due.
   * Rules:
   *   - amount > 0 required
   *   - overpayment is allowed — just clears the due
   *   - paid_amount accumulates
   *   - when due reaches 0 → status = "paid", history cleared (paid_amount reset to 0)
   *   - when amount < due → status = "partial"
   */
  async recordPayment(owner_id, supplier_id, amount, note) {
    const supplier = await prisma.storeSupplier.findFirst({
      where: { owner_id, supplier_id },
    });

    if (!supplier) {
      throw { code: "NOT_FOUND", message: "Supplier not found." };
    }

    const payAmount = new Prisma.Decimal(amount);
    if (payAmount.lte(0)) {
      throw {
        code: "INVALID_AMOUNT",
        message: "Payment amount must be greater than 0.",
      };
    }

    // 1. Calculate net total purchased amount dynamically
    const [returnsAgg, lots] = await Promise.all([
      prisma.storeSupplierReturn.aggregate({
        where: { owner_id, supplier_id },
        _sum: { total_refund: true },
      }),
      prisma.storeStockLot.findMany({
        where: { owner_id, supplier_id },
        select: { cp: true, qty_in: true },
      }),
    ]);

    const grossPurchasedAmount = lots.reduce((acc, lot) => {
      return acc.add(new Prisma.Decimal(lot.cp).mul(lot.qty_in));
    }, new Prisma.Decimal(0));

    const totalRefund = new Prisma.Decimal(returnsAgg._sum.total_refund ?? 0);
    const totalPurchasedAmount = grossPurchasedAmount.minus(totalRefund);

    // 2. Determine current due and paid amounts
    const currentPaid = new Prisma.Decimal(supplier.paid_amount);
    const currentDue = Prisma.Decimal.max(totalPurchasedAmount.minus(currentPaid), new Prisma.Decimal(0));

    if (payAmount.gt(currentDue)) {
      throw {
        code: "OVERPAYMENT",
        message: `Payment amount (${payAmount}) exceeds due amount (${currentDue}). Cannot overpay.`,
      };
    }

    const newDue = currentDue.sub(payAmount);
    const newPaid = currentPaid.add(payAmount);

    let payment_status;
    let finalDue;
    let finalPaid;

    if (newDue.eq(0)) {
      payment_status = "paid";
      finalDue = new Prisma.Decimal(0);
      finalPaid = newPaid;
    } else {
      payment_status = "partial";
      finalDue = newDue;
      finalPaid = newPaid;
    }

    return prisma.$transaction(async (tx) => {
      let title = await tx.storeExpenseTitle.findFirst({
        where: { owner_id, title: "Supplier Payment" },
      });

      if (!title) {
        title = await tx.storeExpenseTitle.create({
          data: {
            owner_id,
            title: "Supplier Payment",
          },
        });
      }

      const paymentNote = `${(note || `Payment to supplier ${supplier.supplier_name}`).trim()} [SUPPLIER_PAYMENT:${supplier_id}]`;
      await tx.storeExpense.create({
        data: {
          owner_id,
          title_id: title.title_id,
          amount: payAmount,
          note: paymentNote,
        },
      });

      return tx.storeSupplier.update({
        where: { supplier_id },
        data: {
          due_amount: finalDue,
          paid_amount: finalPaid,
          payment_status,
        },
      });
    });
  }

  async getPayments(owner_id, supplier_id) {
    const expenses = await prisma.storeExpense.findMany({
      where: {
        owner_id,
        note: {
          contains: `[SUPPLIER_PAYMENT:${supplier_id}]`,
        },
      },
      orderBy: { created_at: "desc" },
    });

    return expenses.map((exp) => {
      const suffix = ` [SUPPLIER_PAYMENT:${supplier_id}]`;
      let cleanNote = exp.note || "";
      if (cleanNote.endsWith(suffix)) {
        cleanNote = cleanNote.substring(0, cleanNote.length - suffix.length);
      }
      return {
        expense_id: exp.expense_id,
        amount: Number(exp.amount),
        note: cleanNote,
        created_at: exp.created_at,
      };
    });
  }

  async remove(owner_id, supplier_id) {
    const supplier = await prisma.storeSupplier.findFirst({
      where: { owner_id, supplier_id },
      select: { supplier_id: true, supplier_name: true },
    });

    if (!supplier) {
      throw { code: "NOT_FOUND", message: "Supplier not found." };
    }

    const stockLotCount = await prisma.storeStockLot.count({
      where: { supplier_id },
    });

    if (stockLotCount > 0) {
      throw {
        code: "IN_USE",
        message: `Cannot delete supplier "${supplier.supplier_name}". It has ${stockLotCount} stock lot(s) linked. Please reassign or remove them first.`,
        details: { stockLots: stockLotCount },
      };
    }

    await prisma.storeSupplier.delete({ where: { supplier_id } });
    return true;
  }
}

export default new StoreSupplierService();
