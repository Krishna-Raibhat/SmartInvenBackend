import prisma from '../config/prisma.js';
import { Prisma } from '@prisma/client';
import { generateAndUploadBarcode } from '../utils/barcode.js';
import { v4 as uuidv4 } from 'uuid';

class GroceryStockLotService {
  /**
   * Create a new stock lot
   */
  async create({
    owner_id,
    product_id,
    supplier_id,
    qty_in,
    cp,
    sp,
    batch_no,
    expiry_date,
    notes,
  }) {
    // Verify product belongs to owner
    const product = await prisma.groceryProduct.findFirst({
      where: { product_id, owner_id },
      select: {
        product_id: true,
        product_name: true,
        category: { select: { category_id: true, category_name: true } },
        brand: { select: { brand_id: true, brand_name: true } },
        unit: { select: { unit_id: true, unit_name: true } },
      },
    });

    if (!product) {
      const e = new Error('Product not found for this owner');
      e.status = 404;
      e.code = 'PRODUCT_NOT_FOUND';
      throw e;
    }

    // Verify supplier belongs to owner
    const supplier = await prisma.grocerySupplier.findFirst({
      where: { supplier_id, owner_id },
      select: {
        supplier_id: true,
        supplier_name: true,
        phone: true,
      },
    });

    if (!supplier) {
      const e = new Error('Supplier not found for this owner');
      e.status = 404;
      e.code = 'SUPPLIER_NOT_FOUND';
      throw e;
    }

    // Create stock lot with barcode
    const lot_id = uuidv4();
    console.log(`[GROCERY] Generating barcode for lot: ${lot_id}`);
    const { barcode, barcode_image_url } = await generateAndUploadBarcode(lot_id);
    console.log(`[GROCERY] Barcode generated: ${barcode}`);

    const lot = await prisma.groceryStockLot.create({
      data: {
        lot_id,
        owner_id,
        product_id,
        supplier_id,
        qty_in: new Prisma.Decimal(qty_in),
        qty_remaining: new Prisma.Decimal(qty_in),
        cp: new Prisma.Decimal(cp),
        sp: new Prisma.Decimal(sp),
        batch_no: batch_no || null,
        expiry_date: expiry_date ? new Date(expiry_date) : null,
        notes: notes || null,
        barcode,
        barcode_image_url,
      },
      include: {
        product: {
          select: {
            product_name: true,
            category: { select: { category_name: true } },
            brand: { select: { brand_name: true } },
            unit: { select: { unit_name: true } },
          },
        },
        supplier: {
          select: { supplier_name: true, phone: true },
        },
      },
    });

    return {
      product,
      supplier,
      lot,
    };
  }

  /**
   * Get all stock lots for an owner
   */
  async getAll(owner_id) {
    return prisma.groceryStockLot.findMany({
      where: { owner_id },
      include: {
        product: {
          select: {
            product_id: true,
            product_name: true,
            category: { select: { category_id: true, category_name: true } },
            brand: { select: { brand_id: true, brand_name: true } },
            unit: { select: { unit_id: true, unit_name: true } },
          },
        },
        supplier: {
          select: { supplier_id: true, supplier_name: true, phone: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Get stock lots by product
   */
  async getByProduct(owner_id, product_id) {
    // Verify product belongs to owner
    const product = await prisma.groceryProduct.findFirst({
      where: { product_id, owner_id },
    });

    if (!product) {
      const e = new Error('Product not found for this owner');
      e.status = 404;
      e.code = 'PRODUCT_NOT_FOUND';
      throw e;
    }

    return prisma.groceryStockLot.findMany({
      where: { product_id, owner_id },
      include: {
        supplier: {
          select: { supplier_id: true, supplier_name: true, phone: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Get a single stock lot by ID
   */
  async getById(owner_id, lot_id) {
    return prisma.groceryStockLot.findFirst({
      where: { lot_id, owner_id },
      include: {
        product: {
          select: {
            product_id: true,
            product_name: true,
            category: { select: { category_id: true, category_name: true } },
            brand: { select: { brand_id: true, brand_name: true } },
            unit: { select: { unit_id: true, unit_name: true } },
          },
        },
        supplier: {
          select: { supplier_id: true, supplier_name: true, phone: true },
        },
      },
    });
  }

  /**
   * Update a stock lot
   */
  async update(owner_id, lot_id, { cp, sp, batch_no, expiry_date, notes }) {
    // Check if lot exists and belongs to owner
    const existing = await prisma.groceryStockLot.findFirst({
      where: { lot_id, owner_id },
      select: { lot_id: true },
    });

    if (!existing) return null;

    // Build update data
    const data = {};
    if (cp !== undefined) data.cp = new Prisma.Decimal(cp);
    if (sp !== undefined) data.sp = new Prisma.Decimal(sp);
    if (batch_no !== undefined) data.batch_no = batch_no || null;
    if (expiry_date !== undefined) {
      data.expiry_date = expiry_date ? new Date(expiry_date) : null;
    }
    if (notes !== undefined) data.notes = notes || null;

    return await prisma.groceryStockLot.update({
      where: { lot_id },
      data,
      include: {
        product: {
          select: {
            product_name: true,
            category: { select: { category_name: true } },
            brand: { select: { brand_name: true } },
            unit: { select: { unit_name: true } },
          },
        },
        supplier: {
          select: { supplier_name: true, phone: true },
        },
      },
    });
  }

  /**
   * Delete a stock lot
   */
  async remove(owner_id, lot_id) {
    // Check if lot exists and belongs to owner
    const existing = await prisma.groceryStockLot.findFirst({
      where: { lot_id, owner_id },
      select: { lot_id: true, qty_in: true, qty_remaining: true },
    });

    if (!existing) return null;

    // Check if any quantity has been sold
    const qtyIn = parseFloat(existing.qty_in.toString());
    const qtyRemaining = parseFloat(existing.qty_remaining.toString());

    if (qtyIn !== qtyRemaining) {
      return false; // Cannot delete if partially sold
    }

    await prisma.groceryStockLot.delete({ where: { lot_id } });
    return true;
  }
}

export default new GroceryStockLotService();
