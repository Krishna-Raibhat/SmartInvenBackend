// src/services/groceryBatchSyncService.js
import prisma from "../config/prisma.js";
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
   * Handles CREATE, UPDATE, DELETE operations
   * Handles dependencies automatically
   */
  async batchSync(
    owner_id,
    {
      categories,
      brands,
      units,
      suppliers,
      products,
      stock_lots,
      sales,
      returns,
    },
  ) {
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
            const operation = cat.operation || "create"; // Default to create

            if (operation === "create") {
              const existing = await this.findByIdempotencyKey(
                owner_id,
                "category",
                cat.local_id,
              );
              if (existing) {
                result.synced.categories.push({
                  local_id: cat.local_id,
                  server_id: existing.category_id,
                  status: "already_synced",
                });

                result.id_mapping[cat.local_id] = existing.category_id;
              } else {
                // CHECK EXISTING CATEGORY BY NAME
                const duplicate = await prisma.groceryCategory.findFirst({
                  where: {
                    category_name: String(cat.category_name)
                      .trim()
                      .toLowerCase(),
                    deleted_at: null,
                  },
                });

                // DUPLICATE FOUND
                if (duplicate) {
                  // SAVE IDEMPOTENCY MAPPING
                  await this.saveIdempotencyKey(
                    owner_id,
                    "category",
                    cat.local_id,
                    duplicate.category_id,
                    "create",
                  );

                  result.synced.categories.push({
                    local_id: cat.local_id,
                    server_id: duplicate.category_id,
                    status: "duplicate_merged",
                  });

                  result.id_mapping[cat.local_id] = duplicate.category_id;
                } else {
                  // CREATE NEW CATEGORY
                  const created = await groceryCategoryService.create({
                    category_name: cat.category_name,
                  });

                  await this.saveIdempotencyKey(
                    owner_id,
                    "category",
                    cat.local_id,
                    created.category_id,
                    "create",
                  );

                  result.synced.categories.push({
                    local_id: cat.local_id,
                    server_id: created.category_id,
                    status: "created",
                  });

                  result.id_mapping[cat.local_id] = created.category_id;
                }
              }
            } else if (operation === "update") {
              const category_id = cat.category_id || cat.local_id;

              const updated = await groceryCategoryService.update(category_id, {
                category_name: cat.category_name,
              });

              if (!updated) {
                throw new Error(`Category not found: ${category_id}`);
              }

              result.synced.categories.push({
                local_id: cat.local_id,
                server_id: category_id,
                status: "updated",
              });
            } else if (operation === "delete") {
              const category_id = cat.category_id || cat.local_id;

              const deleted = await groceryCategoryService.remove(category_id);

              if (deleted === null) {
                throw new Error(`Category not found: ${category_id}`);
              }

              if (deleted === false) {
                throw new Error(`Category has linked products`);
              }

              result.synced.categories.push({
                local_id: cat.local_id,
                server_id: category_id,
                status: "deleted",
              });
            }
          } catch (err) {
            result.failed.push({
              type: "category",
              local_id: cat.local_id,
              operation: cat.operation || "create",
              error: err.message,
            });
          }
        }
      }

      // 2. Sync Brands (no dependencies)
      if (brands && brands.length > 0) {
        for (const brand of brands) {
          try {
            const operation = brand.operation || "create";

            if (operation === "create") {
              const existing = await this.findByIdempotencyKey(
                owner_id,
                "brand",
                brand.local_id,
              );

              if (existing) {
                result.synced.brands.push({
                  local_id: brand.local_id,
                  server_id: existing.brand_id,
                  status: "already_synced",
                });

                result.id_mapping[brand.local_id] = existing.brand_id;
              } else {
                // CHECK DUPLICATE BRAND
                const duplicate = await prisma.groceryBrand.findFirst({
                  where: {
                    brand_name: String(brand.brand_name).trim().toLowerCase(),
                    deleted_at: null,
                  },
                });

                // DUPLICATE FOUND
                if (duplicate) {
                  await this.saveIdempotencyKey(
                    owner_id,
                    "brand",
                    brand.local_id,
                    duplicate.brand_id,
                    "create",
                  );

                  result.synced.brands.push({
                    local_id: brand.local_id,
                    server_id: duplicate.brand_id,
                    status: "duplicate_merged",
                  });

                  result.id_mapping[brand.local_id] = duplicate.brand_id;
                } else {
                  // CREATE NEW BRAND
                  const created = await groceryBrandService.create({
                    brand_name: brand.brand_name,
                  });

                  await this.saveIdempotencyKey(
                    owner_id,
                    "brand",
                    brand.local_id,
                    created.brand_id,
                    "create",
                  );

                  result.synced.brands.push({
                    local_id: brand.local_id,
                    server_id: created.brand_id,
                    status: "created",
                  });

                  result.id_mapping[brand.local_id] = created.brand_id;
                }
              }
            } else if (operation === "update") {
              const brand_id = brand.brand_id || brand.local_id;

              const updated = await groceryBrandService.update(brand_id, {
                brand_name: brand.brand_name,
              });

              if (!updated) {
                throw new Error(`Brand not found: ${brand_id}`);
              }

              result.synced.brands.push({
                local_id: brand.local_id,
                server_id: brand_id,
                status: "updated",
              });
            } else if (operation === "delete") {
              const brand_id = brand.brand_id || brand.local_id;

              const deleted = await groceryBrandService.remove(brand_id);

              if (deleted === null) {
                throw new Error(`Brand not found: ${brand_id}`);
              }

              if (deleted === false) {
                throw new Error(`Brand has linked products`);
              }

              result.synced.brands.push({
                local_id: brand.local_id,
                server_id: brand_id,
                status: "deleted",
              });
            }
          } catch (err) {
            result.failed.push({
              type: "brand",
              local_id: brand.local_id,
              operation: brand.operation || "create",
              error: err.message,
            });
          }
        }
      }

      // 3. Sync Units (no dependencies)
      if (units && units.length > 0) {
        for (const unit of units) {
          try {
            const operation = unit.operation || "create";

            if (operation === "create") {
              const existing = await this.findByIdempotencyKey(
                owner_id,
                "unit",
                unit.local_id,
              );

              if (existing) {
                result.synced.units.push({
                  local_id: unit.local_id,
                  server_id: existing.unit_id,
                  status: "already_synced",
                });

                result.id_mapping[unit.local_id] = existing.unit_id;
              } else {
                // CHECK DUPLICATE UNIT
                const duplicate = await prisma.groceryUnit.findFirst({
                  where: {
                    owner_id,
                    unit_name: String(unit.unit_name).trim().toLowerCase(),
                    deleted_at: null,
                  },
                });

                // DUPLICATE FOUND
                if (duplicate) {
                  await this.saveIdempotencyKey(
                    owner_id,
                    "unit",
                    unit.local_id,
                    duplicate.unit_id,
                    "create",
                  );

                  result.synced.units.push({
                    local_id: unit.local_id,
                    server_id: duplicate.unit_id,
                    status: "duplicate_merged",
                  });

                  result.id_mapping[unit.local_id] = duplicate.unit_id;
                } else {
                  // CREATE NEW UNIT
                  const created = await groceryUnitService.createUnit(
                    owner_id,
                    unit.unit_name,
                  );

                  await this.saveIdempotencyKey(
                    owner_id,
                    "unit",
                    unit.local_id,
                    created.unit_id,
                    "create",
                  );

                  result.synced.units.push({
                    local_id: unit.local_id,
                    server_id: created.unit_id,
                    status: "created",
                  });

                  result.id_mapping[unit.local_id] = created.unit_id;
                }
              }
            } else if (operation === "update") {
              const unit_id = unit.unit_id || unit.local_id;

              const updated = await groceryUnitService.updateUnit(
                unit_id,
                owner_id,
                unit.unit_name,
              );

              if (!updated) {
                throw new Error(`Unit not found: ${unit_id}`);
              }

              result.synced.units.push({
                local_id: unit.local_id,
                server_id: unit_id,
                status: "updated",
              });
            } else if (operation === "delete") {
              const unit_id = unit.unit_id || unit.local_id;

              const deleted = await groceryUnitService.deleteUnit(
                owner_id,
                unit_id,
              );

              if (deleted === null) {
                throw new Error(`Unit not found: ${unit_id}`);
              }

              if (deleted === false) {
                throw new Error(`Unit has linked products`);
              }

              result.synced.units.push({
                local_id: unit.local_id,
                server_id: unit_id,
                status: "deleted",
              });
            }
          } catch (err) {
            result.failed.push({
              type: "unit",
              local_id: unit.local_id,
              operation: unit.operation || "create",
              error: err.message,
            });
          }
        }
      }

      // 4. Sync Suppliers (no dependencies)
      if (suppliers && suppliers.length > 0) {
        for (const supplier of suppliers) {
          try {
            const operation = supplier.operation || "create";

            if (operation === "create") {
              const existing = await this.findByIdempotencyKey(
                owner_id,
                "supplier",
                supplier.local_id,
              );

              if (existing) {
                result.synced.suppliers.push({
                  local_id: supplier.local_id,
                  server_id: existing.supplier_id,
                  status: "already_synced",
                });

                result.id_mapping[supplier.local_id] = existing.supplier_id;
              } else {
                // CHECK DUPLICATE SUPPLIER
                const duplicate = await prisma.grocerySupplier.findFirst({
                  where: {
                    owner_id,
                    supplier_name: String(supplier.supplier_name)
                      .trim()
                      .toLowerCase(),
                    phone: supplier.phone || null,
                    deleted_at: null,
                  },
                });

                // DUPLICATE FOUND
                if (duplicate) {
                  await this.saveIdempotencyKey(
                    owner_id,
                    "supplier",
                    supplier.local_id,
                    duplicate.supplier_id,
                    "create",
                  );

                  result.synced.suppliers.push({
                    local_id: supplier.local_id,
                    server_id: duplicate.supplier_id,
                    status: "duplicate_merged",
                  });

                  result.id_mapping[supplier.local_id] = duplicate.supplier_id;
                } else {
                  // CREATE NEW SUPPLIER
                  const created = await grocerySupplierService.create({
                    owner_id,
                    supplier_name: supplier.supplier_name,
                    phone: supplier.phone,
                    email: supplier.email,
                    address: supplier.address,
                  });

                  await this.saveIdempotencyKey(
                    owner_id,
                    "supplier",
                    supplier.local_id,
                    created.supplier_id,
                    "create",
                  );

                  result.synced.suppliers.push({
                    local_id: supplier.local_id,
                    server_id: created.supplier_id,
                    status: "created",
                  });

                  result.id_mapping[supplier.local_id] = created.supplier_id;
                }
              }
            } else if (operation === "update") {
              const supplier_id = supplier.supplier_id || supplier.local_id;

              const updated = await grocerySupplierService.update(
                owner_id,
                supplier_id,
                {
                  supplier_name: supplier.supplier_name,

                  phone: supplier.phone,

                  email: supplier.email,

                  address: supplier.address,
                },
              );

              if (!updated) {
                throw new Error(`Supplier not found: ${supplier_id}`);
              }

              result.synced.suppliers.push({
                local_id: supplier.local_id,
                server_id: supplier_id,
                status: "updated",
              });
            } else if (operation === "delete") {
              const supplier_id = supplier.supplier_id || supplier.local_id;

              const deleted = await grocerySupplierService.remove(
                owner_id,
                supplier_id,
              );

              if (deleted === null) {
                throw new Error(`Supplier not found: ${supplier_id}`);
              }

              if (deleted === false) {
                throw new Error(`Supplier has linked stock lots`);
              }

              result.synced.suppliers.push({
                local_id: supplier.local_id,
                server_id: supplier_id,
                status: "deleted",
              });
            }
          } catch (err) {
            result.failed.push({
              type: "supplier",
              local_id: supplier.local_id,
              operation: supplier.operation || "create",
              error: err.message,
            });
          }
        }
      }

      // 5. Sync Products (depends on: category, brand, unit)
      if (products && products.length > 0) {
        for (const product of products) {
          try {
            const operation = product.operation || "create";

            if (operation === "create") {
              // CHECK EXISTING IDEMPOTENCY
              const existing = await this.findByIdempotencyKey(
                owner_id,
                "product",
                product.local_id,
              );

              // ALREADY SYNCED
              if (existing) {
                result.synced.products.push({
                  local_id: product.local_id,
                  server_id: existing.product_id,
                  status: "already_synced",
                });

                result.id_mapping[product.local_id] = existing.product_id;
              } else {
                // MAP LOCAL IDS TO SERVER IDS
                const category_id = product.category_id
                  ? result.id_mapping[product.category_id.toString()] ||
                    product.category_id
                  : null;

                const brand_id = product.brand_id
                  ? result.id_mapping[product.brand_id.toString()] ||
                    product.brand_id
                  : null;

                const unit_id =
                  result.id_mapping[product.unit_id.toString()] ||
                  product.unit_id;

                // CHECK DUPLICATE PRODUCT
                const duplicate = await prisma.groceryProduct.findFirst({
                  where: {
                    owner_id,
                    product_name: String(product.product_name)
                      .trim()
                      .toLowerCase(),
                    category_id: category_id || null,
                    brand_id: brand_id || null,
                    unit_id,
                    deleted_at: null,
                  },
                });

                // DUPLICATE FOUND
                if (duplicate) {
                  // SAVE IDEMPOTENCY
                  await this.saveIdempotencyKey(
                    owner_id,
                    "product",
                    product.local_id,
                    duplicate.product_id,
                    "create",
                  );

                  result.synced.products.push({
                    local_id: product.local_id,
                    server_id: duplicate.product_id,
                    status: "duplicate_merged",
                  });

                  result.id_mapping[product.local_id] = duplicate.product_id;
                } else {
                  // CREATE NEW PRODUCT
                  const created = await groceryProductService.create({
                    owner_id,
                    category_id,
                    brand_id,
                    unit_id,
                    product_name: product.product_name,
                    barcode: product.barcode,
                    description: product.description,
                  });

                  // SAVE IDEMPOTENCY
                  await this.saveIdempotencyKey(
                    owner_id,
                    "product",
                    product.local_id,
                    created.product_id,
                    "create",
                  );

                  result.synced.products.push({
                    local_id: product.local_id,
                    server_id: created.product_id,
                    status: "created",
                  });

                  result.id_mapping[product.local_id] = created.product_id;
                }
              }
            } else if (operation === "update") {
              const product_id = product.product_id || product.local_id;

              const updated = await groceryProductService.update(
                owner_id,
                product_id,
                {
                  category_id: product.category_id,

                  brand_id: product.brand_id,

                  unit_id: product.unit_id,

                  product_name: product.product_name,

                  barcode: product.barcode,

                  description: product.description,
                },
              );

              if (!updated) {
                throw new Error(`Product not found: ${product_id}`);
              }

              result.synced.products.push({
                local_id: product.local_id,
                server_id: product_id,
                status: "updated",
              });
            } // PRODUCT DELETE
            else if (operation === "delete") {
              const product_id = product.product_id || product.local_id;

              // DIRECT DELETE
              const deleted = await groceryProductService.remove(
                owner_id,
                product_id,
              );

              if (deleted === null) {
                throw new Error(`Product not found: ${product_id}`);
              }

              if (deleted === false) {
                throw new Error(`Product has linked stock/sales`);
              }

              result.synced.products.push({
                local_id: product.local_id,
                server_id: product_id,
                status: "deleted",
              });
            }
          } catch (err) {
            result.failed.push({
              type: "product",
              local_id: product.local_id,
              operation: product.operation || "create",
              error: err.message,
            });
          }
        }
      }

      // // 6. Sync Stock Lots (depends on: product, supplier)
      // if (stock_lots && stock_lots.length > 0) {
      //   for (const lot of stock_lots) {
      //     try {
      //       const existing = await this.findByIdempotencyKey(
      //         owner_id,
      //         "stock_lot",
      //         lot.local_id,
      //       );
      //       if (existing) {
      //         result.synced.stock_lots.push({
      //           local_id: lot.local_id,
      //           server_id: existing.lot_id,
      //           status: "already_synced",
      //         });
      //         result.id_mapping[lot.local_id] = existing.lot_id;
      //       } else {
      //         // Map local IDs to server IDs
      //         const product_id =
      //           result.id_mapping[lot.product_id] || lot.product_id;
      //         const supplier_id =
      //           result.id_mapping[lot.supplier_id] || lot.supplier_id;

      //         const created = await groceryStockLotService.create({
      //           owner_id,
      //           product_id,
      //           supplier_id,
      //           qty_in: lot.qty_in,
      //           cp: lot.cp,
      //           sp: lot.sp,
      //           batch_no: lot.batch_no,
      //           expiry_date: lot.expiry_date,
      //           notes: lot.notes,
      //         });
      //         await this.saveIdempotencyKey(
      //           owner_id,
      //           "stock_lot",
      //           lot.local_id,
      //           created.lot.lot_id,
      //         );
      //         result.synced.stock_lots.push({
      //           local_id: lot.local_id,
      //           server_id: created.lot.lot_id,
      //           status: "created",
      //         });
      //         result.id_mapping[lot.local_id] = created.lot.lot_id;
      //       }
      //     } catch (err) {
      //       result.failed.push({
      //         type: "stock_lot",
      //         local_id: lot.local_id,
      //         error: err.message,
      //       });
      //     }
      //   }
      // }

      // 6. Sync Stock Lots (depends on: product, supplier)
      if (stock_lots && stock_lots.length > 0) {
        for (const lot of stock_lots) {
          try {
            const operation = lot.operation || "create";

            if (operation === "create") {
              // CHECK IDEMPOTENCY
              const existing = await this.findByIdempotencyKey(
                owner_id,
                "stock_lot",
                lot.local_id,
              );

              // ALREADY SYNCED
              if (existing) {
                result.synced.stock_lots.push({
                  local_id: lot.local_id,
                  server_id: existing.lot_id,
                  status: "already_synced",
                });

                result.id_mapping[lot.local_id] = existing.lot_id;
              } else {
                // MAP LOCAL IDS
                const product_id =
                  result.id_mapping[lot.product_id?.toString()] || lot.product_id;

                const supplier_id =
                  result.id_mapping[lot.supplier_id?.toString()] ||
                  lot.supplier_id;

                // VALIDATE PRODUCT
                const productExists = await prisma.groceryProduct.findFirst({
                  where: {
                    product_id,
                    owner_id,
                  },
                });

                if (!productExists) {
                  throw new Error(`Invalid product mapping: ${product_id}`);
                }

                // VALIDATE SUPPLIER
                const supplierExists = await prisma.grocerySupplier.findFirst({
                  where: {
                    supplier_id,
                    owner_id,
                  },
                });

                if (!supplierExists) {
                  throw new Error(`Invalid supplier mapping: ${supplier_id}`);
                }

                // OPTIONAL DUPLICATE CHECK
                const duplicate = await prisma.groceryStockLot.findFirst({
                  where: {
                    owner_id,
                    product_id,
                    supplier_id,
                    batch_no: lot.batch_no || null,
                  },
                });

                // DUPLICATE FOUND
                if (duplicate) {
                  await this.saveIdempotencyKey(
                    owner_id,
                    "stock_lot",
                    lot.local_id,
                    duplicate.lot_id,
                  );

                  result.synced.stock_lots.push({
                    local_id: lot.local_id,
                    server_id: duplicate.lot_id,
                    status: "duplicate_merged",
                  });

                  result.id_mapping[lot.local_id] = duplicate.lot_id;
                } else {
                  // CREATE LOT
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

                  // SAVE IDEMPOTENCY
                  await this.saveIdempotencyKey(
                    owner_id,
                    "stock_lot",
                    lot.local_id,
                    created.lot.lot_id,
                  );

                  result.synced.stock_lots.push({
                    local_id: lot.local_id,
                    server_id: created.lot.lot_id,
                    status: "created",
                  });

                  result.id_mapping[lot.local_id] = created.lot.lot_id;
                }
              }
            } else if (operation === "update") {
              // UPDATE STOCK LOT
              const lot_id = lot.lot_id || lot.local_id;

              const updated = await groceryStockLotService.update(
                owner_id,
                lot_id,
                {
                  cp: lot.cp,
                  sp: lot.sp,
                  batch_no: lot.batch_no,
                  expiry_date: lot.expiry_date,
                  notes: lot.notes,
                  qty_remaining: lot.qty_remaining,
                  qty_in: lot.qty_in,
                },
              );

              if (!updated) {
                throw new Error(`Stock lot not found: ${lot_id}`);
              }

              result.synced.stock_lots.push({
                local_id: lot.local_id,
                server_id: lot_id,
                status: "updated",
              });
            } else if (operation === "delete") {
              // DELETE STOCK LOT
              const lot_id = lot.lot_id || lot.local_id;

              const deleted = await groceryStockLotService.remove(
                owner_id,
                lot_id,
              );

              if (deleted === null) {
                throw new Error(`Stock lot not found: ${lot_id}`);
              }

              if (deleted === false) {
                throw new Error(
                  `Cannot delete stock lot because some quantity has been sold`,
                );
              }

              result.synced.stock_lots.push({
                local_id: lot.local_id,
                server_id: lot_id,
                status: "deleted",
              });
            }
          } catch (err) {
            result.failed.push({
              type: "stock_lot",
              local_id: lot.local_id,
              operation: lot.operation || "create",
              error: err.message,
            });
          }
        }
      }

      // 7. Sync Sales (depends on: product)
      if (sales && sales.length > 0) {
        for (const sale of sales) {
          try {
            const operation = sale.operation || "create";

            if (operation === "create") {
              const existing = await this.findByIdempotencyKey(
                owner_id,
                "sale",
                sale.local_id,
              );
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
                  product_id:
                    result.id_mapping[item.product_id] || item.product_id,
                }));

                const created = await grocerySalesService.createSale(owner_id, {
                  customer: sale.customer,
                  items,
                  total_amount: sale.total_amount,
                  paid_amount: sale.paid_amount,
                  payment_status: sale.payment_status,
                  payment_method: sale.payment_method,
                  note: sale.note,
                });
                await this.saveIdempotencyKey(
                  owner_id,
                  "sale",
                  sale.local_id,
                  created.sales_id,
                  "create",
                );
                result.synced.sales.push({
                  local_id: sale.local_id,
                  server_id: created.sales_id,
                  status: "created",
                });
                result.id_mapping[sale.local_id] = created.sales_id;
              }
            } else if (operation === "update") {
              const updateResult = await this.handleUpdate(
                owner_id,
                "sale",
                sale,
              );
              result.synced.sales.push(updateResult);
            } else if (operation === "delete") {
              const deleteResult = await this.handleDelete(
                owner_id,
                "sale",
                sale,
              );
              result.synced.sales.push(deleteResult);
            }
          } catch (err) {
            result.failed.push({
              type: "sale",
              local_id: sale.local_id,
              operation: sale.operation || "create",
              error: err.message,
            });
          }
        }
      }

      // 8. Sync Returns (depends on: sale)
      if (returns && returns.length > 0) {
        for (const ret of returns) {
          try {
            const operation = ret.operation || "create";

            if (operation === "create") {
              const existing = await this.findByIdempotencyKey(
                owner_id,
                "return",
                ret.local_id,
              );
              if (existing) {
                result.synced.returns.push({
                  local_id: ret.local_id,
                  server_id: existing.server_id,
                  status: "already_synced",
                });

                result.id_mapping[ret.local_id] = existing.server_id;
              } else {
                // Map local sale ID to server ID
                const sales_id =
                  result.id_mapping[ret.sales_id] || ret.sales_id;

                const created = await groceryCustomerReturnService.createReturn(
                  owner_id,
                  {
                    sales_id,

                    note: ret.reason,

                    items: ret.items,

                    refund_amount: ret.refund_amount,
                  },
                );
                await this.saveIdempotencyKey(
                  owner_id,
                  "return",
                  ret.local_id,
                  created.return.return_id,
                  "create",
                );
                result.synced.returns.push({
                  local_id: ret.local_id,
                  server_id: created.return.return_id,
                  status: "created",
                });
                result.id_mapping[ret.local_id] = created.return.return_id;
              }
            } else if (operation === "update") {
              const updateResult = await this.handleUpdate(
                owner_id,
                "return",
                ret,
              );
              result.synced.returns.push(updateResult);
            } else if (operation === "delete") {
              const deleteResult = await this.handleDelete(
                owner_id,
                "return",
                ret,
              );
              result.synced.returns.push(deleteResult);
            }
          } catch (err) {
            result.failed.push({
              type: "return",
              local_id: ret.local_id,
              operation: ret.operation || "create",
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
  async saveIdempotencyKey(
    owner_id,
    entity_type,
    local_id,
    server_id,
    operation = "create",
  ) {
    await prisma.syncIdempotency.upsert({
      where: {
        owner_id_entity_type_local_id: {
          owner_id,
          entity_type,
          local_id,
        },
      },
      update: {
        server_id,
        operation,
        last_synced_at: new Date(),
      },
      create: {
        owner_id,
        entity_type,
        local_id,
        server_id,
        operation,
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
      category: () =>
        prisma.groceryCategory.findUnique({
          where: { category_id: record.server_id },
        }),
      brand: () =>
        prisma.groceryBrand.findUnique({
          where: { brand_id: record.server_id },
        }),
      unit: () =>
        prisma.groceryUnit.findFirst({
          where: { unit_id: record.server_id, owner_id },
        }),
      supplier: () =>
        prisma.grocerySupplier.findFirst({
          where: { supplier_id: record.server_id, owner_id },
        }),
      product: () =>
        prisma.groceryProduct.findFirst({
          where: { product_id: record.server_id, owner_id },
        }),
      stock_lot: () =>
        prisma.groceryStockLot.findFirst({
          where: { lot_id: record.server_id, owner_id },
        }),
      sale: () =>
        prisma.grocerySales.findFirst({
          where: { sales_id: record.server_id, owner_id },
        }),
      return: () =>
        prisma.groceryCustomerReturn.findFirst({
          where: { return_id: record.server_id, owner_id },
        }),
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

  /**
   * Pull changes from server since last sync
   * Returns all created, updated, and deleted records
   */
  async pullChanges(owner_id, since = null) {
    const sinceDate = since ? new Date(since) : new Date(0); // Epoch if no since provided

    const result = {
      categories: await this.pullEntityChanges(
        "groceryCategory",
        owner_id,
        sinceDate,
        "category_id",
      ),
      brands: await this.pullEntityChanges(
        "groceryBrand",
        owner_id,
        sinceDate,
        "brand_id",
        false,
      ),
      units: await this.pullEntityChanges(
        "groceryUnit",
        owner_id,
        sinceDate,
        "unit_id",
      ),
      suppliers: await this.pullEntityChanges(
        "grocerySupplier",
        owner_id,
        sinceDate,
        "supplier_id",
      ),
      products: await this.pullEntityChanges(
        "groceryProduct",
        owner_id,
        sinceDate,
        "product_id",
      ),
      stock_lots: await this.pullEntityChanges(
        "groceryStockLot",
        owner_id,
        sinceDate,
        "lot_id",
      ),
      sales: await this.pullEntityChanges(
        "grocerySales",
        owner_id,
        sinceDate,
        "sales_id",
        true,
        {
          include: { items: true },
        },
      ),
      returns: await this.pullEntityChanges(
        "groceryCustomerReturn",
        owner_id,
        sinceDate,
        "return_id",
        true,
        {
          include: { items: true },
        },
      ),
      last_sync_timestamp: new Date().toISOString(),
    };

    return result;
  }

  /**
   * Helper to pull changes for a specific entity type
   */
  async pullEntityChanges(
    modelName,
    owner_id,
    sinceDate,
    idField,
    ownerScoped = true,
    options = {},
  ) {
    const model = prisma[modelName];

    const baseWhere = ownerScoped ? { owner_id } : {};

    // Get created records
    const created = await model.findMany({
      where: {
        ...baseWhere,
        created_at: { gte: sinceDate },
        deleted_at: null,
      },
      ...options,
    });

    // Get updated records (not newly created)
    const updated = await model.findMany({
      where: {
        ...baseWhere,
        updated_at: { gte: sinceDate },
        created_at: { lt: sinceDate },
        deleted_at: null,
      },
      ...options,
    });

    // Get deleted records (soft deleted)
    const deleted = await model.findMany({
      where: {
        ...baseWhere,
        deleted_at: { gte: sinceDate },
      },
      select: {
        [idField]: true,
        deleted_at: true,
      },
    });

    return {
      created,
      updated,
      deleted: deleted.map((d) => ({
        id: d[idField],
        deleted_at: d.deleted_at,
      })),
    };
  }

  /**
   * Process a single entity operation (create, update, delete)
   */
  async processEntityOperation(owner_id, entityType, operation, data) {
    const { local_id, server_id } = data;

    try {
      switch (operation) {
        case "create":
          return await this.handleCreate(owner_id, entityType, data);

        case "update":
          return await this.handleUpdate(owner_id, entityType, data);

        case "delete":
          return await this.handleDelete(owner_id, entityType, data);

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle CREATE operation
   */
  async handleCreate(owner_id, entityType, data) {
    const { local_id, ...createData } = data;

    const entityMap = {
      category: async () => {
        const duplicate = await prisma.groceryCategory.findFirst({
          where: {
            category_name: String(createData.category_name)
              .trim()
              .toLowerCase(),
            deleted_at: null,
          },
        });

        if (duplicate) {
          await this.saveIdempotencyKey(
            owner_id,
            entityType,
            local_id,
            duplicate.category_id,
            "create",
          );
          return {
            server_id: duplicate.category_id,
            status: "duplicate_merged",
          };
        }

        const created = await groceryCategoryService.create({
          category_name: createData.category_name,
        });

        await this.saveIdempotencyKey(
          owner_id,
          entityType,
          local_id,
          created.category_id,
          "create",
        );
        return { server_id: created.category_id, status: "created" };
      },

      brand: async () => {
        const duplicate = await prisma.groceryBrand.findFirst({
          where: {
            brand_name: String(createData.brand_name).trim().toLowerCase(),
            deleted_at: null,
          },
        });

        if (duplicate) {
          await this.saveIdempotencyKey(
            owner_id,
            entityType,
            local_id,
            duplicate.brand_id,
            "create",
          );
          return { server_id: duplicate.brand_id, status: "duplicate_merged" };
        }

        const created = await groceryBrandService.create({
          brand_name: createData.brand_name,
        });

        await this.saveIdempotencyKey(
          owner_id,
          entityType,
          local_id,
          created.brand_id,
          "create",
        );
        return { server_id: created.brand_id, status: "created" };
      },

      unit: async () => {
        const duplicate = await prisma.groceryUnit.findFirst({
          where: {
            owner_id,
            unit_name: String(createData.unit_name).trim().toLowerCase(),
            deleted_at: null,
          },
        });

        if (duplicate) {
          await this.saveIdempotencyKey(
            owner_id,
            entityType,
            local_id,
            duplicate.unit_id,
            "create",
          );
          return { server_id: duplicate.unit_id, status: "duplicate_merged" };
        }

        const created = await groceryUnitService.createUnit(
          owner_id,
          createData.unit_name,
        );
        await this.saveIdempotencyKey(
          owner_id,
          entityType,
          local_id,
          created.unit_id,
          "create",
        );
        return { server_id: created.unit_id, status: "created" };
      },

      supplier: async () => {
        const duplicate = await prisma.grocerySupplier.findFirst({
          where: {
            owner_id,
            supplier_name: String(createData.supplier_name)
              .trim()
              .toLowerCase(),
            phone: createData.phone || null,
            deleted_at: null,
          },
        });

        if (duplicate) {
          await this.saveIdempotencyKey(
            owner_id,
            entityType,
            local_id,
            duplicate.supplier_id,
            "create",
          );
          return {
            server_id: duplicate.supplier_id,
            status: "duplicate_merged",
          };
        }

        const created = await grocerySupplierService.create({
          owner_id,
          supplier_name: createData.supplier_name,
          phone: createData.phone,
          email: createData.email,
          address: createData.address,
        });

        await this.saveIdempotencyKey(
          owner_id,
          entityType,
          local_id,
          created.supplier_id,
          "create",
        );
        return { server_id: created.supplier_id, status: "created" };
      },
    };

    const result = await entityMap[entityType]();
    return {
      status: result.status,
      local_id,
      server_id: result.server_id,
    };
  }

  /**
   * Handle UPDATE operation
   */
  async handleUpdate(owner_id, entityType, data) {
    const { local_id, server_id, ...updateData } = data;

    // Find the server ID from idempotency table if not provided
    const finalServerId =
      server_id ||
      (await this.findByIdempotencyKey(owner_id, entityType, local_id))?.[
        this.getIdField(entityType)
      ];

    if (!finalServerId) {
      throw new Error(
        `Cannot update: record not found for local_id ${local_id}`,
      );
    }

    const entityMap = {
      category: () =>
        prisma.groceryCategory.update({
          where: { category_id: finalServerId },
          data: { category_name: updateData.category_name },
        }),
      brand: () =>
        prisma.groceryBrand.update({
          where: { brand_id: finalServerId },
          data: { brand_name: updateData.brand_name },
        }),
      unit: () =>
        prisma.groceryUnit.update({
          where: { unit_id: finalServerId, owner_id },
          data: { unit_name: updateData.unit_name },
        }),
      supplier: () =>
        prisma.grocerySupplier.update({
          where: { supplier_id: finalServerId, owner_id },
          data: {
            supplier_name: updateData.supplier_name,
            phone: updateData.phone,
            email: updateData.email,
            address: updateData.address,
          },
        }),
      product: () =>
        prisma.groceryProduct.update({
          where: { product_id: finalServerId, owner_id },
          data: {
            product_name: updateData.product_name,
            category_id: updateData.category_id,
            brand_id: updateData.brand_id,
            unit_id: updateData.unit_id,
            barcode: updateData.barcode,
            description: updateData.description,
          },
        }),
      stock_lot: () =>
        prisma.groceryStockLot.update({
          where: { lot_id: finalServerId, owner_id },
          data: {
            qty_remaining: updateData.qty_remaining,
            sp: updateData.sp,
            notes: updateData.notes,
          },
        }),
      sale: () =>
        prisma.grocerySales.update({
          where: { sales_id: finalServerId, owner_id },
          data: {
            payment_status: updateData.payment_status,
            paid_amount: updateData.paid_amount,
            note: updateData.note,
          },
        }),
    };

    const updated = await entityMap[entityType]();

    // Update idempotency record
    await this.saveIdempotencyKey(
      owner_id,
      entityType,
      local_id,
      finalServerId,
      "update",
    );

    return {
      status: "updated",
      local_id,
      server_id: finalServerId,
    };
  }

  /**
   * Handle DELETE operation (soft delete)
   */
  async handleDelete(owner_id, entityType, data) {
    const { local_id, server_id } = data;

    // Find the server ID from idempotency table if not provided
    const finalServerId =
      server_id ||
      (await this.findByIdempotencyKey(owner_id, entityType, local_id))?.[
        this.getIdField(entityType)
      ];

    if (!finalServerId) {
      throw new Error(
        `Cannot delete: record not found for local_id ${local_id}`,
      );
    }

    const entityMap = {
      category: () =>
        prisma.groceryCategory.update({
          where: { category_id: finalServerId },
          data: { deleted_at: new Date() },
        }),
      brand: () =>
        prisma.groceryBrand.update({
          where: { brand_id: finalServerId },
          data: { deleted_at: new Date() },
        }),
      unit: () =>
        prisma.groceryUnit.update({
          where: { unit_id: finalServerId, owner_id },
          data: { deleted_at: new Date() },
        }),
      supplier: () =>
        prisma.grocerySupplier.update({
          where: { supplier_id: finalServerId, owner_id },
          data: { deleted_at: new Date() },
        }),
      product: () =>
        prisma.groceryProduct.update({
          where: { product_id: finalServerId, owner_id },
          data: { deleted_at: new Date() },
        }),
      stock_lot: () =>
        prisma.groceryStockLot.update({
          where: { lot_id: finalServerId, owner_id },
          data: { deleted_at: new Date() },
        }),
      sale: () =>
        prisma.grocerySales.update({
          where: { sales_id: finalServerId, owner_id },
          data: { deleted_at: new Date() },
        }),
      return: () =>
        prisma.groceryCustomerReturn.update({
          where: { return_id: finalServerId, owner_id },
          data: { deleted_at: new Date() },
        }),
    };

    await entityMap[entityType]();

    // Update idempotency record
    await this.saveIdempotencyKey(
      owner_id,
      entityType,
      local_id,
      finalServerId,
      "delete",
    );

    return {
      status: "deleted",
      local_id,
      server_id: finalServerId,
    };
  }

  /**
   * Get ID field name for entity type
   */
  getIdField(entityType) {
    const idFieldMap = {
      category: "category_id",
      brand: "brand_id",
      unit: "unit_id",
      supplier: "supplier_id",
      product: "product_id",
      stock_lot: "lot_id",
      sale: "sales_id",
      return: "return_id",
    };
    return idFieldMap[entityType];
  }
}

export default new GroceryBatchSyncService();
