// src/services/hardwareBatchSyncService.js
import { prisma } from "../prisma/client.js";
import hardwareCategoryService from "./hardwareCategoryService.js";
import hardwareSupplierService from "./hardwareSupplierService.js";
import hardwareProductService from "./hardwareProductService.js";
import hardwareStockInService from "./hardwareStockInService.js";
import hardwareStockOutService from "./hardwareStockOutService.js";

class HardwareBatchSyncService {
  /**
   * Batch sync multiple items in correct order
   * Handles CREATE operations only
   * Handles dependencies automatically
   */
  async batchSync(
    owner_id,
    {
      categories,
      suppliers,
      products,
      stock_in,
      stock_out,
    },
  ) {
    const result = {
      synced: {
        categories: [],
        suppliers: [],
        products: [],
        stock_in: [],
        stock_out: [],
      },
      failed: [],
      id_mapping: {}, // Maps local_id to server_id
    };

    try {
      // 1. Sync Categories (no dependencies)
      if (categories && categories.length > 0) {
        for (const cat of categories) {
          try {
            const operation = cat.operation || "create";

            if (operation === "create") {
              const existing = await this.findByIdempotencyKey(
                owner_id,
                "hardware_category",
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
                const owner = await prisma.owner.findUnique({
                  where: { owner_id },
                  select: { package_id: true },
                });

                if (!owner?.package_id) {
                  throw new Error("Owner has no package_id");
                }

                const duplicate = await prisma.hardwareCategory.findFirst({
                  where: {
                    package_id: owner.package_id,
                    category_name: String(cat.category_name)
                      .trim()
                      .toLowerCase(),
                  },
                });

                // DUPLICATE FOUND
                if (duplicate) {
                  await this.saveIdempotencyKey(
                    owner_id,
                    "hardware_category",
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
                  const created = await prisma.hardwareCategory.create({
                    data: {
                      package_id: owner.package_id,
                      category_name: String(cat.category_name)
                        .trim()
                        .toLowerCase(),
                    },
                  });

                  await this.saveIdempotencyKey(
                    owner_id,
                    "hardware_category",
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

      // 2. Sync Suppliers (no dependencies)
      if (suppliers && suppliers.length > 0) {
        for (const supplier of suppliers) {
          try {
            const operation = supplier.operation || "create";

            if (operation === "create") {
              const existing = await this.findByIdempotencyKey(
                owner_id,
                "hardware_supplier",
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
                const duplicate = await prisma.hardwareSupplier.findFirst({
                  where: {
                    owner_id,
                    supplier_name: String(supplier.supplier_name)
                      .trim()
                      .toLowerCase(),
                    phone: supplier.phone || null,
                  },
                });

                // DUPLICATE FOUND
                if (duplicate) {
                  await this.saveIdempotencyKey(
                    owner_id,
                    "hardware_supplier",
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
                  const created = await hardwareSupplierService.create({
                    owner_id,
                    supplier_name: supplier.supplier_name,
                    phone: supplier.phone,
                    email: supplier.email,
                    address: supplier.address,
                  });

                  await this.saveIdempotencyKey(
                    owner_id,
                    "hardware_supplier",
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

      // 3. Sync Products (depends on: category)
      if (products && products.length > 0) {
        for (const product of products) {
          try {
            const operation = product.operation || "create";

            if (operation === "create") {
              const existing = await this.findByIdempotencyKey(
                owner_id,
                "hardware_product",
                product.local_id,
              );

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

                // CHECK DUPLICATE PRODUCT
                const duplicate = await prisma.hardwareProduct.findFirst({
                  where: {
                    owner_id,
                    product_name: String(product.product_name)
                      .trim()
                      .toLowerCase(),
                    category_id: category_id || null,
                  },
                });

                // DUPLICATE FOUND
                if (duplicate) {
                  await this.saveIdempotencyKey(
                    owner_id,
                    "hardware_product",
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
                  const created = await hardwareProductService.createProductMaster({
                    owner_id,
                    category_id,
                    product_name: product.product_name,
                  });

                  await this.saveIdempotencyKey(
                    owner_id,
                    "hardware_product",
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

      // 4. Sync Stock In (depends on: product, supplier)
      // Only CREATE operation supported - no UPDATE/DELETE
      if (stock_in && stock_in.length > 0) {
        for (const lot of stock_in) {
          try {
            const existing = await this.findByIdempotencyKey(
              owner_id,
              "hardware_stock_in",
              lot.local_id,
            );

            if (existing) {
              result.synced.stock_in.push({
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
              const productExists = await prisma.hardwareProduct.findFirst({
                where: {
                  product_id,
                  owner_id,
                },
              });

              if (!productExists) {
                throw new Error(`Invalid product mapping: ${product_id}`);
              }

              // VALIDATE SUPPLIER
              const supplierExists = await prisma.hardwareSupplier.findFirst({
                where: {
                  supplier_id,
                  owner_id,
                },
              });

              if (!supplierExists) {
                throw new Error(`Invalid supplier mapping: ${supplier_id}`);
              }

              // CREATE STOCK IN
              const created = await hardwareStockInService.stockIn({
                owner_id,
                product_id,
                supplier_id,
                cp: lot.cp,
                sp: lot.sp,
                qty: lot.qty_in,
                notes: lot.notes,
              });

              await this.saveIdempotencyKey(
                owner_id,
                "hardware_stock_in",
                lot.local_id,
                created.lot_id,
              );

              result.synced.stock_in.push({
                local_id: lot.local_id,
                server_id: created.lot_id,
                status: "created",
              });

              result.id_mapping[lot.local_id] = created.lot_id;
            }
          } catch (err) {
            result.failed.push({
              type: "stock_in",
              local_id: lot.local_id,
              operation: "create",
              error: err.message,
            });
          }
        }
      }

      // 5. Sync Stock Out (depends on: product)
      // Only CREATE operation supported - no UPDATE/DELETE
      if (stock_out && stock_out.length > 0) {
        for (const out of stock_out) {
          try {
            const existing = await this.findByIdempotencyKey(
              owner_id,
              "hardware_stock_out",
              out.local_id,
            );

            if (existing) {
              result.synced.stock_out.push({
                local_id: out.local_id,
                server_id: existing.stockout_id,
                status: "already_synced",
              });

              result.id_mapping[out.local_id] = existing.stockout_id;
            } else {
              // MAP LOCAL IDS
              const items = out.items.map((item) => ({
                product_id:
                  result.id_mapping[item.product_id?.toString()] ||
                  item.product_id,
                lot_id:
                  result.id_mapping[item.lot_id?.toString()] || item.lot_id,
                qty: item.qty,
                sp: item.sp,
                note: item.note,
              }));

              // CREATE STOCK OUT
              const created = await hardwareStockOutService.createStockOut({
                owner_id,
                customer_name: out.customer_name,
                customer_phn_number: out.customer_phn_number,
                customer_address: out.customer_address,
                payment_status: out.payment_status,
                paid_amount: out.paid_amount || 0,
                note: out.note,
                items,
              });

              await this.saveIdempotencyKey(
                owner_id,
                "hardware_stock_out",
                out.local_id,
                created.header.stockout_id,
              );

              result.synced.stock_out.push({
                local_id: out.local_id,
                server_id: created.header.stockout_id,
                status: "created",
              });

              result.id_mapping[out.local_id] = created.header.stockout_id;
            }
          } catch (err) {
            result.failed.push({
              type: "stock_out",
              local_id: out.local_id,
              operation: "create",
              error: err.message,
            });
          }
        }
      }

      return result;
    } catch (err) {
      console.error("❌ Batch sync error:", err);
      throw err;
    }
  }

  /**
   * Find idempotency record
   */
  async findByIdempotencyKey(owner_id, entity_type, local_id) {
    const record = await prisma.syncIdempotency.findUnique({
      where: {
        owner_id_entity_type_local_id: {
          owner_id,
          entity_type,
          local_id,
        },
      },
    });

    if (!record) return null;

    // Return the server_id mapped to the entity type
    return { [entity_type.split("_").pop() + "_id"]: record.server_id };
  }

  /**
   * Save idempotency record
   */
  async saveIdempotencyKey(owner_id, entity_type, local_id, server_id, operation = "create") {
    return prisma.syncIdempotency.upsert({
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
}

export default new HardwareBatchSyncService();
