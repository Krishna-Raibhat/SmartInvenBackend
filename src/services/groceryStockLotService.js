import prisma from '../prisma/client.js';
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
   * Get stock lot by barcode (for barcode scanning)
   */
  async getByBarcode(owner_id, barcode) {
    const lot = await prisma.groceryStockLot.findFirst({
      where: { barcode, owner_id },
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

    if (!lot) {
      const e = new Error('Lot not found for this barcode');
      e.status = 404;
      e.code = 'LOT_NOT_FOUND';
      throw e;
    }

    return {
      ...lot,
      barcode_image_url: lot.barcode_image_url
        ? `https://s3-np1.datahub.com.np/${process.env.AWS_S3_BUCKET}/${lot.barcode_image_url}`
        : null,
    };
  }

  /**
   * Update a stock lot
   */
  async update(owner_id, lot_id, { cp, sp, batch_no, expiry_date, notes, qty_remaining, qty_in }) {
    // Check if lot exists and belongs to owner
    const existing = await prisma.groceryStockLot.findFirst({
      where: { lot_id, owner_id },
      select: { lot_id: true, qty_in: true, qty_remaining: true },
    });

    if (!existing) return null;

    const currentQtyIn = parseFloat(existing.qty_in.toString());
    const currentQtyRemaining = parseFloat(existing.qty_remaining.toString());
    const qtySold = currentQtyIn - currentQtyRemaining;

    // Determine the new qty_in (use provided value or keep existing)
    const newQtyIn = qty_in !== undefined ? qty_in : currentQtyIn;

    // Determine the new qty_remaining (use provided value or keep existing)
    const newQtyRemaining = qty_remaining !== undefined ? qty_remaining : currentQtyRemaining;

    // Validate qty_in is not less than qty_sold
    if (newQtyIn < qtySold) {
      const e = new Error(
        `qty_in cannot be less than qty_sold (${qtySold}). ` +
        `You've already sold ${qtySold} units, so qty_in must be at least ${qtySold}`
      );
      e.status = 400;
      e.code = 'VALIDATION_QTY_IN_LESS_THAN_SOLD';
      throw e;
    }

    // Validate qty_remaining doesn't exceed new qty_in
    if (newQtyRemaining > newQtyIn) {
      const e = new Error(
        `qty_remaining (${newQtyRemaining}) cannot exceed qty_in (${newQtyIn})`
      );
      e.status = 400;
      e.code = 'VALIDATION_QTY_REMAINING_EXCEEDS_QTY_IN';
      throw e;
    }

    // Validate qty_remaining is not less than qty_sold
    if (newQtyRemaining < qtySold) {
      const e = new Error(
        `qty_remaining cannot be less than qty_sold (${qtySold}). ` +
        `Current: qty_in=${currentQtyIn}, qty_sold=${qtySold}, qty_remaining=${currentQtyRemaining}`
      );
      e.status = 400;
      e.code = 'VALIDATION_QTY_REMAINING_LESS_THAN_SOLD';
      throw e;
    }

    // Build update data
    const data = {};
    if (cp !== undefined) data.cp = new Prisma.Decimal(cp);
    if (sp !== undefined) data.sp = new Prisma.Decimal(sp);
    if (batch_no !== undefined) data.batch_no = batch_no || null;
    if (expiry_date !== undefined) {
      data.expiry_date = expiry_date ? new Date(expiry_date) : null;
    }
    if (notes !== undefined) data.notes = notes || null;
    if (qty_remaining !== undefined) data.qty_remaining = new Prisma.Decimal(qty_remaining);
    if (qty_in !== undefined) data.qty_in = new Prisma.Decimal(qty_in);

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
