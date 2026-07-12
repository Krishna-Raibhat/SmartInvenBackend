import prisma from '../prisma/client.js';

class GroceryProductService {
  /**
   * Create a new grocery product
   */
  async create({
    owner_id,
    category_id,
    brand_id,
    unit_id,
    product_name,
    barcode,
    description,
  }) {
    try {
      return await prisma.groceryProduct.create({
        data: {
          owner_id,
          category_id: category_id || null,
          brand_id: brand_id || null,
          unit_id,
          product_name,
          barcode: barcode || null,
          description: description || null,
        },
        include: {
          category: true,
          brand: true,
          unit: true,
        },
      });
    } catch (err) {
      if (err.code === 'P2003') {
        const unit = await prisma.groceryUnit.findFirst({
          where: { unit_id, owner_id },
        });
        if (!unit) {
          const e = new Error('Unit not found for this owner');
          e.status = 404;
          e.code = 'UNIT_NOT_FOUND';
          throw e;
        }
        if (category_id) {
          const category = await prisma.groceryCategory.findUnique({
            where: { category_id },
          });
          if (!category) {
            const e = new Error('Category not found');
            e.status = 404;
            e.code = 'CATEGORY_NOT_FOUND';
            throw e;
          }
        }
        if (brand_id) {
          const brand = await prisma.groceryBrand.findUnique({
            where: { brand_id },
          });
          if (!brand) {
            const e = new Error('Brand not found');
            e.status = 404;
            e.code = 'BRAND_NOT_FOUND';
            throw e;
          }
        }
      }

      // Handle unique constraint violations
      if (err.code === 'P2002') {
        const targets = err.meta?.target || [];
        if (targets.includes('owner_id') && targets.includes('product_name')) {
          const e = new Error('Product name already exists for this owner');
          e.status = 409;
          e.code = 'PRODUCT_NAME_ALREADY_EXISTS';
          throw e;
        }
        if (targets.includes('barcode')) {
          const e = new Error('Barcode already exists');
          e.status = 409;
          e.code = 'BARCODE_ALREADY_EXISTS';
          throw e;
        }
      }
      throw err;
    }
  }

  /**
   * Get all products for an owner
   */
  async list(owner_id) {
    return prisma.groceryProduct.findMany({
      where: { owner_id },
      orderBy: { created_at: 'desc' },
      include: {
        category: true,
        brand: true,
        unit: true,
      },
    });
  }

  /**
   * Get a single product by ID
   */
  async getById(owner_id, product_id) {
    return prisma.groceryProduct.findFirst({
      where: { owner_id, product_id },
      include: {
        category: true,
        brand: true,
        unit: true,
        stockLots: {
          include: {
            supplier: true,
          },
          orderBy: { created_at: 'desc' },
        },
      },
    });
  }

  /**
   * Get product by barcode
   */
  async getByBarcode(owner_id, barcode) {
    const product = await prisma.groceryProduct.findFirst({
      where: { barcode, owner_id },
      include: {
        category: true,
        brand: true,
        unit: true,
        stockLots: {
          where: { qty_remaining: { gt: 0 } },
          include: {
            supplier: true,
          },
          orderBy: { created_at: 'asc' }, // FIFO
        },
      },
    });

    if (!product) {
      const e = new Error('Product not found for this barcode');
      e.status = 404;
      e.code = 'PRODUCT_NOT_FOUND';
      throw e;
    }

    return product;
  }

  /**
   * Update a product
   */
  async update(
    owner_id,
    product_id,
    {
      category_id,
      brand_id,
      unit_id,
      product_name,
      barcode,
      description,
    }
  ) {
    // Check if product exists and belongs to owner
    const existing = await prisma.groceryProduct.findFirst({
      where: { owner_id, product_id },
      select: { product_id: true },
    });

    if (!existing) return null;

    // Build update data
    const data = {};
    if (category_id !== undefined) data.category_id = category_id || null;
    if (brand_id !== undefined) data.brand_id = brand_id || null;
    if (unit_id !== undefined) data.unit_id = unit_id;
    if (product_name !== undefined) data.product_name = product_name;
    if (barcode !== undefined) data.barcode = barcode || null;
    if (description !== undefined) data.description = description || null;

    try {
      return await prisma.groceryProduct.update({
        where: { product_id },
        data,
        include: {
          category: true,
          brand: true,
          unit: true,
        },
      });
    } catch (err) {
      if (err.code === 'P2003') {
        if (unit_id) {
          const unit = await prisma.groceryUnit.findFirst({
            where: { unit_id, owner_id },
          });
          if (!unit) {
            const e = new Error('Unit not found for this owner');
            e.status = 404;
            e.code = 'UNIT_NOT_FOUND';
            throw e;
          }
        }
        if (category_id) {
          const category = await prisma.groceryCategory.findUnique({
            where: { category_id },
          });
          if (!category) {
            const e = new Error('Category not found');
            e.status = 404;
            e.code = 'CATEGORY_NOT_FOUND';
            throw e;
          }
        }
        if (brand_id) {
          const brand = await prisma.groceryBrand.findUnique({
            where: { brand_id },
          });
          if (!brand) {
            const e = new Error('Brand not found');
            e.status = 404;
            e.code = 'BRAND_NOT_FOUND';
            throw e;
          }
        }
      }

      if (err.code === 'P2002') {
        const targets = err.meta?.target || [];
        if (targets.includes('owner_id') && targets.includes('product_name')) {
          const e = new Error('Product name already exists for this owner');
          e.status = 409;
          e.code = 'PRODUCT_NAME_ALREADY_EXISTS';
          throw e;
        }
        if (targets.includes('barcode')) {
          const e = new Error('Barcode already exists');
          e.status = 409;
          e.code = 'BARCODE_ALREADY_EXISTS';
          throw e;
        }
      }
      throw err;
    }
  }

  /**
   * Delete a product
   */
  async remove(owner_id, product_id) {
    // Check if product exists and belongs to owner
    const existing = await prisma.groceryProduct.findFirst({
      where: { owner_id, product_id },
      select: { product_id: true },
    });

    if (!existing) return null;

    // Check if product has stock lots
    const linkedLots = await prisma.groceryStockLot.count({
      where: { product_id },
    });

    if (linkedLots > 0) return false;

    await prisma.groceryProduct.delete({ where: { product_id } });
    return true;
  }

  /**
   * Get average cost and total inventory value
   */
  async getAverageCost(owner_id) {
    // Get all products for this owner
    const products = await prisma.groceryProduct.findMany({
      where: { owner_id },
      select: { product_id: true, product_name: true },
    });

    if (products.length === 0) {
      return null;
    }

    const productIds = products.map(p => p.product_id);

    // Get all lots with remaining stock across all products
    const lots = await prisma.groceryStockLot.findMany({
      where: { 
        product_id: { in: productIds },
        product: { owner_id },
        qty_remaining: { gt: 0 }
      },
      select: {
        lot_id: true,
        product_id: true,
        cp: true,
        qty_remaining: true,
      },
    });

    if (lots.length === 0) {
      return {
        total_products: products.length,
        total_products_with_stock: 0,
        total_qty_remaining: 0,
        weighted_average_cp: 0,
        total_inventory_value: 0,
      };
    }

    // Calculate weighted average CP across all products
    let totalCost = 0;
    let totalQty = 0;
    const productsWithStock = new Set();

    lots.forEach(lot => {
      const cp = Number(lot.cp);
      const qty = Number(lot.qty_remaining);
      const lotCost = cp * qty;

      totalCost += lotCost;
      totalQty += qty;
      productsWithStock.add(lot.product_id);
    });

    const weightedAverageCp = totalQty > 0 ? totalCost / totalQty : 0;

    return {
      total_products: products.length,
      total_products_with_stock: productsWithStock.size,
      total_qty_remaining: totalQty,
      weighted_average_cp: Number(weightedAverageCp.toFixed(2)),
      total_inventory_value: Number(totalCost.toFixed(2)),
    };
  }
}

export default new GroceryProductService();
