// src/services/groceryBatchSyncService.js
import prisma from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import groceryCategoryService from "./groceryCategoryService.js";
import groceryBrandService from "./groceryBrandService.js";
import groceryUnitService from "./groceryUnitService.js";
import grocerySupplierService from "./grocerySupplierService.js";
import groceryProductService from "./groceryProductService.js";
import groceryStockLotService from "./groceryStockLotService.js";
import grocerySalesService from "./grocerySalesService.js";
import groceryCustomerReturnService from "./groceryCustomerReturnService.js";

class GroceryBatchSyncService {
  /**
   * Batch sync multiple items in correct order
   * Handles dependencies automatically
   */
  async batchSync(owner_id, { categories, brands, units, suppliers, products, stock_lots, sales, returns }) {
    const result = {
      synced: {
        categories: [],
        brands: [],
        units: [],
        suppliers: [],
        products: [],
        stock_lots: [],
        sales: [],
        returns: [],
      },
      failed: [],
      id_mapping: {}, // Maps local_id to server_id
    };

    try {
      // 1. Sync Categories (no dependencies)
      if (categories && categories.length > 0) {
        for (const cat of categories) {
          try {
            const existing = await this.findByIdempotencyKey(owner_id, "category", cat.local_id);
            if (existing) {
              result.synced.categories.push({
                local_id: cat.local_id,
                server_id: existing.category_id,
                status: "already_synced",
              });
              result.id_mapping[cat.local_id] = existing.category_id;
            } else {
              const created = await groceryCategoryService.create(cat.category_name);
              await this.saveIdempotencyKey(owner_id, "category", cat.local_id, created.category_id);
              result.synced.categories.push({
                local_id: cat.local_id,
                server_id: created.category_id,
                status: "created",
              });
              result.id_mapping[cat.local_id] = created.category_id;
            }
          } catch (err) {
            result.failed.push({
              type: "category",
              local_id: cat.local_id,
              error: err.message,
            });
          }
        }
      }

      // 2. Sync Brands (no dependencies)
      if (brands && brands.length > 0) {
        for (const brand of brands) {
          try {
            const existing = await this.findByIdempotencyKey(owner_id, "brand", brand.local_id);
            if (existing) {
              result.synced.brands.push({
                local_id: brand.local_id,
                server_id: existing.brand_id,
                status: "already_synced",
              });
              result.id_mapping[brand.local_id] = existing.brand_id;
            } else {
              const created = await groceryBrandService.create(brand.brand_name);
              await this.saveIdempotencyKey(owner_id, "brand", brand.local_id, created.brand_id);
              result.synced.brands.push({
                local_id: brand.local_id,
                server_id: created.brand_id,
                status: "created",
              });
              result.id_mapping[brand.local_id] = created.brand_id;
            }
          } catch (err) {
            result.failed.push({
              type: "brand",
              local_id: brand.local_id,
              error: err.message,
            });
          }
        }
      }

      // 3. Sync Units (no dependencies)
      if (units && units.length > 0) {
        for (const unit of units) {
          try {
            const existing = await this.findByIdempotencyKey(owner_id, "unit", unit.local_id);
            if (existing) {
              result.synced.units.push({
                local_id: unit.local_id,
                server_id: existing.unit_id,
                status: "already_synced",
              });
              result.id_mapping[unit.local_id] = existing.unit_id;
            } else {
              const created = await groceryUnitService.create(owner_id, unit.unit_name);
              await this.saveIdempotencyKey(owner_id, "unit", unit.local_id, created.unit_id);
              result.synced.units.push({
                local_id: unit.local_id,
                server_id: created.unit_id,
                status: "created",
              });
              result.id_mapping[unit.local_id] = created.unit_id;
            }
          } catch (err) {
            result.failed.push({
              type: "unit",
              local_id: unit.local_id,
              error: err.message,
            });
          }
        }
      }

      // 4. Sync Suppliers (no dependencies)
      if (suppliers && suppliers.length > 0) {
        for (const supplier of suppliers) {
          try {
            const existing = await this.findByIdempotencyKey(owner_id, "supplier", supplier.local_id);
            if (existing) {
              result.synced.suppliers.push({
                local_id: supplier.local_id,
                server_id: existing.supplier_id,
                status: "already_synced",
              });
              result.id_mapping[supplier.local_id] = existing.supplier_id;
            } else {
              const created = await grocerySupplierService.create(owner_id, {
                supplier_name: supplier.supplier_name,
                phone: supplier.phone,
                address: supplier.address,
              });
              await this.saveIdempotencyKey(owner_id, "supplier", supplier.local_id, created.supplier_id);
              result.synced.suppliers.push({
                local_id: supplier.local_id,
                server_id: created.supplier_id,
                status: "created",
              });
              result.id_mapping[supplier.local_id] = created.supplier_id;
            }
          } catch (err) {
            result.failed.push({
              type: "supplier",
              local_id: supplier.local_id,
              error: err.message,
            });
          }
        }
      }

      // 5. Sync Products (depends on: category, brand, unit)
      if (products && products.length > 0) {
        for (const product of products) {
          try {
            const existing = await this.findByIdempotencyKey(owner_id, "product", product.local_id);
            if (existing) {
              result.synced.products.push({
                local_id: product.local_id,
                server_id: existing.product_id,
                status: "already_synced",
              });
              result.id_mapping[product.local_id] = existing.product_id;
            } else {
              // Map local IDs to server IDs
              const category_id = result.id_mapping[product.category_id] || product.category_id;
              const brand_id = result.id_mapping[product.brand_id] || product.brand_id;
              const unit_id = result.id_mapping[product.unit_id] || product.unit_id;

              const created = await groceryProductService.create(owner_id, {
                product_name: product.product_name,
                category_id,
                brand_id,
                unit_id,
              });
              await this.saveIdempotencyKey(owner_id, "product", product.local_id, created.product_id);
              result.synced.products.push({
                local_id: product.local_id,
                server_id: created.product_id,
                status: "created",
              });
              result.id_mapping[product.local_id] = created.product_id;
            }
          } catch (err) {
            result.failed.push({
              type: "product",
              local_id: product.local_id,
              error: err.message,
            });
          }
        }
      }

      // 6. Sync Stock Lots (depends on: product, supplier)
      if (stock_lots && stock_lots.length > 0) {
        for (const lot of stock_lots) {
          try {
            const existing = await this.findByIdempotencyKey(owner_id, "stock_lot", lot.local_id);
            if (existing) {
              result.synced.stock_lots.push({
                local_id: lot.local_id,
                server_id: existing.lot_id,
                status: "already_synced",
              });
              result.id_mapping[lot.local_id] = existing.lot_id;
            } else {
              // Map local IDs to server IDs
              const product_id = result.id_mapping[lot.product_id] || lot.product_id;
              const supplier_id = result.id_mapping[lot.supplier_id] || lot.supplier_id;

              const created = await groceryStockLotService.create({
                owner_id,
                product_id,
                supplier_id,
                qty_in: lot.qty_in,
                cp: lot.cp,
                sp: lot.sp,
                batch_no: lot.batch_no,
                expiry_date: lot.expiry_date,
                notes: lot.notes,
              });
              await this.saveIdempotencyKey(owner_id, "stock_lot", lot.local_id, created.lot.lot_id);
              result.synced.stock_lots.push({
                local_id: lot.local_id,
                server_id: created.lot.lot_id,
                status: "created",
              });
              result.id_mapping[lot.local_id] = created.lot.lot_id;
            }
          } catch (err) {
            result.failed.push({
              type: "stock_lot",
              local_id: lot.local_id,
              error: err.message,
            });
          }
        }
      }

      // 7. Sync Sales (depends on: product)
      if (sales && sales.length > 0) {
        for (const sale of sales) {
          try {
            const existing = await this.findByIdempotencyKey(owner_id, "sale", sale.local_id);
            if (existing) {
              result.synced.sales.push({
                local_id: sale.local_id,
                server_id: existing.sales_id,
                status: "already_synced",
              });
              result.id_mapping[sale.local_id] = existing.sales_id;
            } else {
              // Map local product IDs to server IDs in items
              const items = sale.items.map((item) => ({
                ...item,
                product_id: result.id_mapping[item.product_id] || item.product_id,
              }));

              const created = await grocerySalesService.create(owner_id, {
                customer_name: sale.customer_name,
                customer_phone: sale.customer_phone,
                items,
                total_amount: sale.total_amount,
                paid_amount: sale.paid_amount,
                payment_status: sale.payment_status,
                payment_method: sale.payment_method,
              });
              await this.saveIdempotencyKey(owner_id, "sale", sale.local_id, created.sales_id);
              result.synced.sales.push({
                local_id: sale.local_id,
                server_id: created.sales_id,
                status: "created",
              });
              result.id_mapping[sale.local_id] = created.sales_id;
            }
          } catch (err) {
            result.failed.push({
              type: "sale",
              local_id: sale.local_id,
              error: err.message,
            });
          }
        }
      }

      // 8. Sync Returns (depends on: sale)
      if (returns && returns.length > 0) {
        for (const ret of returns) {
          try {
            const existing = await this.findByIdempotencyKey(owner_id, "return", ret.local_id);
            if (existing) {
              result.synced.returns.push({
                local_id: ret.local_id,
                server_id: existing.return_id,
                status: "already_synced",
              });
              result.id_mapping[ret.local_id] = existing.return_id;
            } else {
              // Map local sale ID to server ID
              const sales_id = result.id_mapping[ret.sales_id] || ret.sales_id;

              const created = await groceryCustomerReturnService.create(owner_id, {
                sales_id,
                items: ret.items,
                refund_amount: ret.refund_amount,
                reason: ret.reason,
              });
              await this.saveIdempotencyKey(owner_id, "return", ret.local_id, created.return_id);
              result.synced.returns.push({
                local_id: ret.local_id,
                server_id: created.return_id,
                status: "created",
              });
              result.id_mapping[ret.local_id] = created.return_id;
            }
          } catch (err) {
            result.failed.push({
              type: "return",
              local_id: ret.local_id,
              error: err.message,
            });
          }
        }
      }

      return result;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Save idempotency key to prevent duplicate syncs
   */
  async saveIdempotencyKey(owner_id, entity_type, local_id, server_id) {
    await prisma.syncIdempotency.create({
      data: {
        owner_id,
        entity_type,
        local_id,
        server_id,
      },
    });
  }

  /**
   * Find existing record by idempotency key
   */
  async findByIdempotencyKey(owner_id, entity_type, local_id) {
    const record = await prisma.syncIdempotency.findFirst({
      where: {
        owner_id,
        entity_type,
        local_id,
      },
    });

    if (!record) return null;

    // Return the actual entity based on type
    const entityMap = {
      category: () => prisma.groceryCategory.findUnique({ where: { category_id: record.server_id } }),
      brand: () => prisma.groceryBrand.findUnique({ where: { brand_id: record.server_id } }),
      unit: () => prisma.groceryUnit.findFirst({ where: { unit_id: record.server_id, owner_id } }),
      supplier: () => prisma.grocerySupplier.findFirst({ where: { supplier_id: record.server_id, owner_id } }),
      product: () => prisma.groceryProduct.findFirst({ where: { product_id: record.server_id, owner_id } }),
      stock_lot: () => prisma.groceryStockLot.findFirst({ where: { lot_id: record.server_id, owner_id } }),
      sale: () => prisma.grocerySales.findFirst({ where: { sales_id: record.server_id, owner_id } }),
      return: () => prisma.groceryCustomerReturn.findFirst({ where: { return_id: record.server_id, owner_id } }),
    };

    return entityMap[entity_type] ? await entityMap[entity_type]() : null;
  }

  /**
   * Get sync status for a list of local IDs
   */
  async getSyncStatus(owner_id, items) {
    const result = [];

    for (const item of items) {
      const record = await prisma.syncIdempotency.findFirst({
        where: {
          owner_id,
          entity_type: item.entity_type,
          local_id: item.local_id,
        },
      });

      result.push({
        entity_type: item.entity_type,
        local_id: item.local_id,
        is_synced: !!record,
        server_id: record?.server_id || null,
        synced_at: record?.created_at || null,
      });
    }

    return result;
  }
}

export default new GroceryBatchSyncService();
