// src/services/storeSupplierReturnService.js
import prisma from '../config/prisma.js';
import { Prisma } from '@prisma/client';

class StoreSupplierReturnService {
  /**
   * Create a new supplier return (immediate stock deduction)
   */
  async createReturn(owner_id, payload) {
    const { supplier_id, note, items } = payload;

    // Validate supplier_id
    if (!supplier_id) {
      const e = new Error('supplier_id is required');
      e.status = 400;
      e.code = 'VALIDATION_SUPPLIER_REQUIRED';
      throw e;
    }

    // Validate items array
    if (!Array.isArray(items) || items.length === 0) {
      const e = new Error('At least one return item is required');
      e.status = 400;
      e.code = 'VALIDATION_NO_ITEMS';
      throw e;
    }

    // Verify supplier exists and belongs to owner
    const supplier = await prisma.storeSupplier.findFirst({
      where: { supplier_id, owner_id },
      select: { supplier_id: true, supplier_name: true },
    });

    if (!supplier) {
      const e = new Error('Supplier not found for this owner');
      e.status = 404;
      e.code = 'SUPPLIER_NOT_FOUND';
      throw e;
    }

    // Use transaction to ensure atomicity
    return prisma.$transaction(async (tx) => {
      let totalRefund = new Prisma.Decimal(0);
      const returnItems = [];

      // Validate and prepare all items first
      for (const item of items) {
        const lot_id = String(item.lot_id || '').trim();
        const qty = Number(item.qty);

        // Validate lot_id
        if (!lot_id) {
          const e = new Error('lot_id is required for each item');
          e.status = 400;
          e.code = 'VALIDATION_LOT_REQUIRED';
          throw e;
        }

        // Validate quantity (must be integer for Store)
        if (!Number.isInteger(qty) || qty <= 0) {
          const e = new Error('qty must be a positive integer');
          e.status = 400;
          e.code = 'VALIDATION_QTY_INVALID';
          throw e;
        }

        // Fetch lot with owner verification
        const lot = await tx.storeStockLot.findFirst({
          where: {
            lot_id,
            owner_id,
          },
          select: {
            lot_id: true,
            supplier_id: true,
            qty_remaining: true,
            cp: true,
            product: {
              select: {
                product_id: true,
                product_name: true,
                type: true,
              },
            },
          },
        });

        if (!lot) {
          const e = new Error(`Stock lot ${lot_id} not found`);
          e.status = 404;
          e.code = 'LOT_NOT_FOUND';
          throw e;
        }

        // Ensure product is an item (not a service)
        if (lot.product.type !== 'item') {
          const e = new Error(
            `Cannot return lot ${lot_id}. Product "${lot.product.product_name}" is a service, not an item.`
          );
          e.status = 400;
          e.code = 'PRODUCT_NOT_ITEM';
          throw e;
        }

        // Verify lot belongs to the selected supplier
        if (lot.supplier_id !== supplier_id) {
          const e = new Error(
            `Stock lot ${lot_id} does not belong to supplier ${supplier.supplier_name}`
          );
          e.status = 400;
          e.code = 'LOT_SUPPLIER_MISMATCH';
          throw e;
        }

        // Check if sufficient quantity available
        const qtyRemaining = lot.qty_remaining;
        if (qtyRemaining < qty) {
          const e = new Error(
            `Insufficient stock for lot ${lot_id}. Available: ${qtyRemaining}, Requested: ${qty}`
          );
          e.status = 400;
          e.code = 'INSUFFICIENT_STOCK';
          throw e;
        }

        // Check if lot has any stock at all
        if (qtyRemaining === 0) {
          const e = new Error(`Cannot return from sold-out lot ${lot_id}`);
          e.status = 400;
          e.code = 'LOT_SOLD_OUT';
          throw e;
        }

        // Calculate refund amount: qty × cp
        const refundAmount = new Prisma.Decimal(qty).mul(lot.cp);
        totalRefund = totalRefund.add(refundAmount);

        returnItems.push({
          lot_id,
          lot,
          qty,
          refund_amount: refundAmount,
          reason: item.reason ? String(item.reason).trim() : null,
          note: item.note ? String(item.note).trim() : null,
        });
      }

      // Create return header
      const returnHeader = await tx.storeSupplierReturn.create({
        data: {
          owner_id,
          supplier_id,
          total_refund: totalRefund,
          note: note ? String(note).trim() : null,
        },
      });

      // Create return items and update stock
      for (const item of returnItems) {
        // Create return item
        await tx.storeSupplierReturnItem.create({
          data: {
            return_id: returnHeader.return_id,
            lot_id: item.lot_id,
            qty: item.qty,
            refund_amount: item.refund_amount,
            reason: item.reason,
            note: item.note,
          },
        });

        // Deduct from stock immediately
        await tx.storeStockLot.update({
          where: { lot_id: item.lot_id },
          data: {
            qty_remaining: {
              decrement: item.qty,
            },
          },
        });
      }

      // Fetch and return complete return data
      return tx.storeSupplierReturn.findUnique({
        where: { return_id: returnHeader.return_id },
        include: {
          supplier: {
            select: {
              supplier_id: true,
              supplier_name: true,
              phone: true,
            },
          },
          items: {
            include: {
              lot: {
                select: {
                  lot_id: true,
                  cp: true,
                  sp: true,
                  qty_remaining: true,
                  product: {
                    select: {
                      product_id: true,
                      product_name: true,
                      type: true,
                      category: {
                        select: {
                          category_id: true,
                          category_name: true,
                        },
                      },
                      unit: {
                        select: {
                          unit_id: true,
                          unit_name: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
    });
  }

  /**
   * Get all returns for an owner
   */
  async list(owner_id) {
    return prisma.storeSupplierReturn.findMany({
      where: { owner_id },
      orderBy: { created_at: 'desc' },
      include: {
        supplier: {
          select: {
            supplier_id: true,
            supplier_name: true,
            phone: true,
          },
        },
        items: {
          include: {
            lot: {
              select: {
                lot_id: true,
                product: {
                  select: {
                    product_id: true,
                    product_name: true,
                  },
                },
              },
            },
          },
        },
      },
      take: 200,
    });
  }

  /**
   * Get a single return by ID
   */
  async getById(owner_id, return_id) {
    return prisma.storeSupplierReturn.findFirst({
      where: { owner_id, return_id },
      include: {
        supplier: {
          select: {
            supplier_id: true,
            supplier_name: true,
            phone: true,
            email: true,
            address: true,
          },
        },
        items: {
          include: {
            lot: {
              select: {
                lot_id: true,
                cp: true,
                sp: true,
                qty_remaining: true,
                product: {
                  select: {
                    product_id: true,
                    product_name: true,
                    type: true,
                    description: true,
                    category: {
                      select: {
                        category_id: true,
                        category_name: true,
                      },
                    },
                    unit: {
                      select: {
                        unit_id: true,
                        unit_name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get returns by supplier
   */
  async getBySupplier(owner_id, supplier_id) {
    return prisma.storeSupplierReturn.findMany({
      where: { owner_id, supplier_id },
      orderBy: { created_at: 'desc' },
      include: {
        items: {
          include: {
            lot: {
              select: {
                lot_id: true,
                product: {
                  select: {
                    product_id: true,
                    product_name: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }
}

export default new StoreSupplierReturnService();
