// src/services/storeStockLotService.js
import { prisma } from "../prisma/client.js";
import { Prisma } from "@prisma/client";

const Decimal = Prisma.Decimal;

class StoreStockLotService {
  async create({ owner_id, product_id, supplier_id, qty_in, cp, sp }) {
    if (!supplier_id) {
      throw { code: "REQUIRED_FIELDS", message: "supplier_id is required." };
    }

    // Fix #1: null/undefined checks instead of falsy (allows 0)
    if (cp === undefined || cp === null) throw { code: "REQUIRED_FIELDS", message: "cp is required." };
    if (sp === undefined || sp === null) throw { code: "REQUIRED_FIELDS", message: "sp is required." };
    if (!qty_in || qty_in <= 0) throw { code: "REQUIRED_FIELDS", message: "qty_in must be greater than 0." };

    // Fix #5: positive price validation
    if (Number(cp) < 0) throw { code: "VALIDATION_ERROR", message: "cp cannot be negative." };
    if (Number(sp) < 0) throw { code: "VALIDATION_ERROR", message: "sp cannot be negative." };

    const [productRows, supplierRows] = await Promise.all([
      prisma.$queryRaw`
        SELECT 
          p.product_id,
          p.owner_id,
          p.category_id,
          p.unit_id,
          p.product_name,
          p.description,
          p.created_at,
          p.updated_at,
          p.cp::numeric,
          p.sp::numeric,
          p.type,
          p.last_low_stock_notified_at,
          c.category_name,
          c.created_at AS cat_created_at,
          c.updated_at AS cat_updated_at,
          u.unit_name,
          u.created_at AS unit_created_at,
          u.updated_at AS unit_updated_at
        FROM store_products p
        LEFT JOIN store_categories c ON p.category_id = c.category_id
        LEFT JOIN store_units u ON p.unit_id = u.unit_id
        WHERE p.product_id = ${product_id} AND p.owner_id = ${owner_id}
      `,
      prisma.storeSupplier.findFirst({
        where: { supplier_id, owner_id }
      })
    ]);

    const pRow = productRows[0];
    if (!pRow) throw { code: "PRODUCT_NOT_FOUND", message: "Product not found." };
    if (pRow.type === "service") throw { code: "VALIDATION_ERROR", message: "Stock lot is not allowed for service." };

    const supplier = supplierRows;
    if (!supplier) throw { code: "SUPPLIER_NOT_FOUND", message: "Supplier not found." };

    const createdLot = await prisma.storeStockLot.create({
      data: {
        owner_id,
        product_id,
        supplier_id,
        qty_in,
        qty_remaining: qty_in,
        cp,
        sp,
      },
    });

    const product = {
      product_id: pRow.product_id,
      owner_id: pRow.owner_id,
      category_id: pRow.category_id,
      unit_id: pRow.unit_id,
      product_name: pRow.product_name,
      description: pRow.description,
      created_at: pRow.created_at,
      updated_at: pRow.updated_at,
      cp: pRow.cp ? new Decimal(pRow.cp) : null,
      sp: pRow.sp ? new Decimal(pRow.sp) : null,
      type: pRow.type,
      last_low_stock_notified_at: pRow.last_low_stock_notified_at,
      category: pRow.category_id ? {
        category_id: pRow.category_id,
        owner_id: pRow.owner_id,
        category_name: pRow.category_name,
        created_at: pRow.cat_created_at,
        updated_at: pRow.cat_updated_at
      } : null,
      unit: pRow.unit_id ? {
        unit_id: pRow.unit_id,
        owner_id: pRow.owner_id,
        unit_name: pRow.unit_name,
        created_at: pRow.unit_created_at,
        updated_at: pRow.unit_updated_at
      } : null
    };

    return {
      ...createdLot,
      product,
      supplier,
    };
  }

  async list(owner_id) {
    return prisma.storeStockLot.findMany({
      where: { owner_id },
      orderBy: { created_at: "desc" },
      include: {
        product: { include: { category: true, unit: true } },
        supplier: true,
      },
    });
  }

  async getByProduct(owner_id, product_id) {
    const [product, lots, suppliers] = await Promise.all([
      prisma.storeProduct.findFirst({
        where: { product_id, owner_id },
        select: { type: true },
      }),
      prisma.storeStockLot.findMany({
        where: { product_id, owner_id },
        orderBy: { created_at: "desc" },
      }),
      prisma.storeSupplier.findMany({
        where: { owner_id },
      }),
    ]);

    if (!product) throw { code: "PRODUCT_NOT_FOUND", message: "Product not found." };
    if (product.type === "service") throw { code: "VALIDATION_ERROR", message: "Service does not have stock lots." };

    const supplierMap = new Map(suppliers.map((s) => [s.supplier_id, s]));

    return lots.map((lot) => ({
      ...lot,
      supplier: supplierMap.get(lot.supplier_id) || null,
    }));
  }

  async getById(owner_id, lot_id) {
    const lot = await prisma.storeStockLot.findFirst({
      where: { lot_id, owner_id },
      include: {
        product: { include: { category: true, unit: true } },
        supplier: true,
      },
    });

    if (!lot) throw { code: "NOT_FOUND", message: "Stock lot not found." };
    return lot;
  }

  async update(owner_id, lot_id, { cp, sp, qty_in, qty_remaining }) {
    const existing = await prisma.storeStockLot.findFirst({
      where: { lot_id, owner_id },
      select: { lot_id: true, qty_in: true, qty_remaining: true },
    });

    if (!existing) throw { code: "NOT_FOUND", message: "Stock lot not found." };

    const currentQtyIn = Number(existing.qty_in);
    const currentQtyRemaining = Number(existing.qty_remaining);
    const qtySold = currentQtyIn - currentQtyRemaining;

    const newQtyIn = qty_in !== undefined ? Number(qty_in) : currentQtyIn;
    const newQtyRemaining = qty_remaining !== undefined ? Number(qty_remaining) : currentQtyRemaining;

    // Fix #3: positive qty_in validation on update
    if (qty_in !== undefined && newQtyIn <= 0) {
      throw { code: "VALIDATION_ERROR", message: "qty_in must be greater than 0." };
    }
    if (newQtyIn < qtySold) {
      throw { code: "VALIDATION_ERROR", message: `qty_in cannot be less than qty sold (${qtySold}).` };
    }
    if (newQtyRemaining > newQtyIn) {
      throw { code: "VALIDATION_ERROR", message: `qty_remaining cannot exceed qty_in (${newQtyIn}).` };
    }
    if (qty_remaining !== undefined && newQtyRemaining < 0) {
      throw { code: "VALIDATION_ERROR", message: "qty_remaining cannot be negative." };
    }

    // Fix #5: positive price validation on update
    if (cp !== undefined && Number(cp) < 0) {
      throw { code: "VALIDATION_ERROR", message: "cp cannot be negative." };
    }
    if (sp !== undefined && Number(sp) < 0) {
      throw { code: "VALIDATION_ERROR", message: "sp cannot be negative." };
    }

    const data = {};
    if (cp !== undefined) data.cp = cp;
    if (sp !== undefined) data.sp = sp;
    if (qty_in !== undefined) data.qty_in = newQtyIn;
    if (qty_remaining !== undefined) data.qty_remaining = newQtyRemaining;

    // Fix #2: include owner_id in where clause for explicit ownership
    return prisma.storeStockLot.update({
      where: { lot_id, owner_id },
      data,
      include: {
        product: { include: { category: true, unit: true } },
        supplier: true,
      },
    });
  }

  async delete(owner_id, lot_id) {
    const existing = await prisma.storeStockLot.findFirst({
      where: { lot_id, owner_id },
      select: { lot_id: true, qty_in: true, qty_remaining: true },
    });

    if (!existing) throw { code: "NOT_FOUND", message: "Stock lot not found." };

    const qtySold = Number(existing.qty_in) - Number(existing.qty_remaining);
    if (qtySold > 0) {
      throw {
        code: "IN_USE",
        message: `Cannot delete lot. ${qtySold} unit(s) already sold.`,
        details: { qty_sold: qtySold },
      };
    }

    await prisma.storeStockLot.delete({ where: { lot_id } });
    return { message: "Stock lot deleted successfully." };
  }
}

export default new StoreStockLotService();
