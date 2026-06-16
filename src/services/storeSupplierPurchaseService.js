import { prisma } from "../prisma/client.js";

class StoreSupplierPurchaseService {

  async create(owner_id, data) {
    const { supplier_id, items, paid_amount = 0, payment_method = "cash", note } = data;

    if (!supplier_id) throw { code: "VALIDATION_ERROR", message: "supplier_id is required." };
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw { code: "VALIDATION_ERROR", message: "At least one item is required." };
    }
    if (!["cash", "online"].includes(payment_method)) {
      throw { code: "VALIDATION_ERROR", message: "payment_method must be 'cash' or 'online'." };
    }

    // Validate supplier ownership
    const supplier = await prisma.storeSupplier.findFirst({
      where: { supplier_id, owner_id },
    });
    if (!supplier) throw { code: "SUPPLIER_NOT_FOUND", message: "Supplier not found." };

    // Validate all products
    for (const item of items) {
      if (!item.product_id) throw { code: "VALIDATION_ERROR", message: "product_id is required for each item." };
      if (!item.qty || parseFloat(item.qty) <= 0) throw { code: "VALIDATION_ERROR", message: "qty must be positive for each item." };
      if (!item.cp || parseFloat(item.cp) <= 0) throw { code: "VALIDATION_ERROR", message: "cp must be positive for each item." };

      const product = await prisma.storeProduct.findFirst({
        where: { product_id: item.product_id, owner_id, deleted_at: null, product_type: "item" },
      });
      if (!product) throw { code: "PRODUCT_NOT_FOUND", message: `Product not found: ${item.product_id}` };
    }

    // Calculate totals
    const computedItems = items.map((item) => ({
      ...item,
      qty: parseFloat(item.qty),
      cp: parseFloat(item.cp),
      line_total: parseFloat(item.qty) * parseFloat(item.cp),
    }));

    const total_amount = computedItems.reduce((sum, item) => sum + item.line_total, 0);
    const parsedPaid = parseFloat(paid_amount);

    if (parsedPaid < 0) throw { code: "VALIDATION_ERROR", message: "paid_amount cannot be negative." };
    if (parsedPaid > total_amount) throw { code: "VALIDATION_ERROR", message: "paid_amount cannot exceed total_amount." };

    // Create purchase + items + update product qty in a transaction
    return await prisma.$transaction(async (tx) => {
      const purchase = await tx.storeSupplierPurchase.create({
        data: {
          owner_id,
          supplier_id,
          total_amount,
          paid_amount: parsedPaid,
          payment_method,
          note: note?.trim() || null,
          items: {
            create: computedItems.map((item) => ({
              product_id: item.product_id,
              qty: item.qty,
              cp: item.cp,
              line_total: item.line_total,
              note: item.note?.trim() || null,
            })),
          },
        },
        include: { items: { include: { product: true } }, supplier: true },
      });

      // Increase product qty for each item
      for (const item of computedItems) {
        await tx.storeProduct.update({
          where: { product_id: item.product_id },
          data: { qty: { increment: item.qty } },
        });
      }

      return purchase;
    });
  }

  async list(owner_id, filters = {}) {
    const { supplier_id } = filters;

    return prisma.storeSupplierPurchase.findMany({
      where: {
        owner_id,
        ...(supplier_id && { supplier_id }),
      },
      include: {
        items: { include: { product: true } },
        supplier: true,
      },
      orderBy: { created_at: "desc" },
    });
  }

  async getById(owner_id, purchase_id) {
    const purchase = await prisma.storeSupplierPurchase.findFirst({
      where: { purchase_id, owner_id },
      include: {
        items: { include: { product: true } },
        supplier: true,
      },
    });

    if (!purchase) throw { code: "NOT_FOUND", message: "Purchase not found." };
    return purchase;
  }

  async pay(owner_id, purchase_id, data) {
    const { paid_amount, payment_method } = data;

    if (paid_amount === undefined || paid_amount === null) {
      throw { code: "VALIDATION_ERROR", message: "paid_amount is required." };
    }
    if (payment_method && !["cash", "online"].includes(payment_method)) {
      throw { code: "VALIDATION_ERROR", message: "payment_method must be 'cash' or 'online'." };
    }

    const purchase = await prisma.storeSupplierPurchase.findFirst({
      where: { purchase_id, owner_id },
    });

    if (!purchase) throw { code: "NOT_FOUND", message: "Purchase not found." };

    const newPaid = parseFloat(paid_amount);
    if (newPaid < 0) throw { code: "VALIDATION_ERROR", message: "paid_amount cannot be negative." };
    if (newPaid > parseFloat(purchase.total_amount)) {
      throw { code: "VALIDATION_ERROR", message: "paid_amount cannot exceed total_amount." };
    }

    return prisma.storeSupplierPurchase.update({
      where: { purchase_id },
      data: {
        paid_amount: newPaid,
        ...(payment_method && { payment_method }),
      },
      include: { items: { include: { product: true } }, supplier: true },
    });
  }

  async getSupplierDue(owner_id, supplier_id) {
    const supplier = await prisma.storeSupplier.findFirst({
      where: { supplier_id, owner_id },
    });
    if (!supplier) throw { code: "NOT_FOUND", message: "Supplier not found." };

    const purchases = await prisma.storeSupplierPurchase.aggregate({
      where: { supplier_id, owner_id },
      _sum: { total_amount: true, paid_amount: true },
    });

    const returns = await prisma.storeSupplierReturn.aggregate({
      where: { supplier_id, owner_id },
      _sum: { amount: true },
    });

    const totalPurchased = parseFloat(purchases._sum.total_amount ?? 0);
    const totalPaid = parseFloat(purchases._sum.paid_amount ?? 0);
    const totalReturned = parseFloat(returns._sum.amount ?? 0);
    const due = totalPurchased - totalPaid - totalReturned;

    return {
      supplier,
      total_purchased: totalPurchased,
      total_paid: totalPaid,
      total_returned: totalReturned,
      due: due < 0 ? 0 : due,
    };
  }
}

export default new StoreSupplierPurchaseService();