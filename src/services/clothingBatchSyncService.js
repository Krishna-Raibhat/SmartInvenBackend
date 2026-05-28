// src/services/clothingBatchSyncService.js
import { prisma } from "../prisma/client.js";
import clothingCategoryService from "./clothingCategoryService.js";
import clothingColorService from "./clothingColorService.js";
import clothingSizeService from "./clothingSizeService.js";
import clothingSupplierService from "./clothingSupplierService.js";
import clothingProductService from "./clothingProductService.js";
import clothingStockLotService from "./clothingStockLotService.js";
import clothingSalesService from "./clothingSalesService.js";
import clothingCustomerReturnService from "./clothingCustomerReturnService.js";

class ClothingBatchSyncService {
  /**
   * Batch sync multiple items in correct order
   * Handles CREATE, UPDATE, DELETE operations for master data
   * Handles CREATE only for transaction data (stock_lots, sales, returns)
   * Handles dependencies automatically
   */
  async batchSync(
    owner_id,
    {
      categories,
      colors,
      sizes,
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
        colors: [],
        sizes: [],
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
                "clothing_category",
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
                const duplicate = await prisma.clothingCategory.findFirst({
                  where: {
                    category_name: String(cat.category_name)
                      .trim()
                      .toLowerCase(),
                  },
                });

                // DUPLICATE FOUND
                if (duplicate) {
                  // SAVE IDEMPOTENCY MAPPING
                  await this.saveIdempotencyKey(
                    owner_id,
                    "clothing_category",
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
                  const created = await clothingCategoryService.create({
                    category_name: cat.category_name,
                  });

                  await this.saveIdempotencyKey(
                    owner_id,
                    "clothing_category",
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

              const updated = await clothingCategoryService.update(category_id, {
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

              const deleted = await clothingCategoryService.remove(category_id);

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

      // 2. Sync Colors (no dependencies)
      if (colors && colors.length > 0) {
        for (const color of colors) {
          try {
            const operation = color.operation || "create";

            if (operation === "create") {
              const existing = await this.findByIdempotencyKey(
                owner_id,
                "clothing_color",
                color.local_id,
              );

              if (existing) {
                result.synced.colors.push({
                  local_id: color.local_id,
                  server_id: existing.color_id,
                  status: "already_synced",
                });

                result.id_mapping[color.local_id] = existing.color_id;
              } else {
                // CHECK DUPLICATE COLOR
                const duplicate = await prisma.clothingColor.findFirst({
                  where: {
                    color_name: String(color.color_name).trim().toLowerCase(),
                  },
                });

                // DUPLICATE FOUND
                if (duplicate) {
                  await this.saveIdempotencyKey(
                    owner_id,
                    "clothing_color",
                    color.local_id,
                    duplicate.color_id,
                    "create",
                  );

                  result.synced.colors.push({
                    local_id: color.local_id,
                    server_id: duplicate.color_id,
                    status: "duplicate_merged",
                  });

                  result.id_mapping[color.local_id] = duplicate.color_id;
                } else {
                  // CREATE NEW COLOR
                  const created = await clothingColorService.create({
                    color_name: color.color_name,
                  });

                  await this.saveIdempotencyKey(
                    owner_id,
                    "clothing_color",
                    color.local_id,
                    created.color_id,
                    "create",
                  );

                  result.synced.colors.push({
                    local_id: color.local_id,
                    server_id: created.color_id,
                    status: "created",
                  });

                  result.id_mapping[color.local_id] = created.color_id;
                }
              }
            } else if (operation === "update") {
              const color_id = color.color_id || color.local_id;

              const updated = await clothingColorService.update(color_id, {
                color_name: color.color_name,
              });

              if (!updated) {
                throw new Error(`Color not found: ${color_id}`);
              }

              result.synced.colors.push({
                local_id: color.local_id,
                server_id: color_id,
                status: "updated",
              });
            } else if (operation === "delete") {
              const color_id = color.color_id || color.local_id;

              const deleted = await clothingColorService.remove(color_id);

              if (deleted === null) {
                throw new Error(`Color not found: ${color_id}`);
              }

              if (deleted === false) {
                throw new Error(`Color has linked stock lots`);
              }

              result.synced.colors.push({
                local_id: color.local_id,
                server_id: color_id,
                status: "deleted",
              });
            }
          } catch (err) {
            result.failed.push({
              type: "color",
              local_id: color.local_id,
              operation: color.operation || "create",
              error: err.message,
            });
          }
        }
      }

      // 3. Sync Sizes (no dependencies)
      if (sizes && sizes.length > 0) {
        for (const size of sizes) {
          try {
            const operation = size.operation || "create";

            if (operation === "create") {
              const existing = await this.findByIdempotencyKey(
                owner_id,
                "clothing_size",
                size.local_id,
              );

              if (existing) {
                result.synced.sizes.push({
                  local_id: size.local_id,
                  server_id: existing.size_id,
                  status: "already_synced",
                });

                result.id_mapping[size.local_id] = existing.size_id;
              } else {
                // CHECK DUPLICATE SIZE
                const duplicate = await prisma.clothingSize.findFirst({
                  where: {
                    size_name: String(size.size_name).trim().toLowerCase(),
                  },
                });

                // DUPLICATE FOUND
                if (duplicate) {
                  await this.saveIdempotencyKey(
                    owner_id,
                    "clothing_size",
                    size.local_id,
                    duplicate.size_id,
                    "create",
                  );

                  result.synced.sizes.push({
                    local_id: size.local_id,
                    server_id: duplicate.size_id,
                    status: "duplicate_merged",
                  });

                  result.id_mapping[size.local_id] = duplicate.size_id;
                } else {
                  // CREATE NEW SIZE
                  const created = await clothingSizeService.create({
                    size_name: size.size_name,
                  });

                  await this.saveIdempotencyKey(
                    owner_id,
                    "clothing_size",
                    size.local_id,
                    created.size_id,
                    "create",
                  );

                  result.synced.sizes.push({
                    local_id: size.local_id,
                    server_id: created.size_id,
                    status: "created",
                  });

                  result.id_mapping[size.local_id] = created.size_id;
                }
              }
            } else if (operation === "update") {
              const size_id = size.size_id || size.local_id;

              const updated = await clothingSizeService.update(size_id, {
                size_name: size.size_name,
              });

              if (!updated) {
                throw new Error(`Size not found: ${size_id}`);
              }

              result.synced.sizes.push({
                local_id: size.local_id,
                server_id: size_id,
                status: "updated",
              });
            } else if (operation === "delete") {
              const size_id = size.size_id || size.local_id;

              const deleted = await clothingSizeService.remove(size_id);

              if (deleted === null) {
                throw new Error(`Size not found: ${size_id}`);
              }

              if (deleted === false) {
                throw new Error(`Size has linked stock lots`);
              }

              result.synced.sizes.push({
                local_id: size.local_id,
                server_id: size_id,
                status: "deleted",
              });
            }
          } catch (err) {
            result.failed.push({
              type: "size",
              local_id: size.local_id,
              operation: size.operation || "create",
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
                "clothing_supplier",
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
                const duplicate = await prisma.clothingSupplier.findFirst({
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
                    "clothing_supplier",
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
                  const created = await clothingSupplierService.create({
                    owner_id,
                    supplier_name: supplier.supplier_name,
                    phone: supplier.phone,
                    email: supplier.email,
                    address: supplier.address,
                  });

                  await this.saveIdempotencyKey(
                    owner_id,
                    "clothing_supplier",
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

              const updated = await clothingSupplierService.update(
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

              const deleted = await clothingSupplierService.remove(
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

      // 5. Sync Products (depends on: category)
      if (products && products.length > 0) {
        for (const product of products) {
          try {
            const operation = product.operation || "create";

            if (operation === "create") {
              // CHECK EXISTING IDEMPOTENCY
              const existing = await this.findByIdempotencyKey(
                owner_id,
                "clothing_product",
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

                // CHECK DUPLICATE PRODUCT
                const duplicate = await prisma.clothingProduct.findFirst({
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
                  // SAVE IDEMPOTENCY
                  await this.saveIdempotencyKey(
                    owner_id,
                    "clothing_product",
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
                  const created = await clothingProductService.create({
                    owner_id,
                    category_id,
                    product_name: product.product_name,
                  });

                  // SAVE IDEMPOTENCY
                  await this.saveIdempotencyKey(
                    owner_id,
                    "clothing_product",
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

              const updated = await clothingProductService.update(
                owner_id,
                product_id,
                {
                  category_id: product.category_id,
                  product_name: product.product_name,
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
            } else if (operation === "delete") {
              const product_id = product.product_id || product.local_id;

              const deleted = await clothingProductService.remove(
                owner_id,
                product_id,
              );

              if (deleted === null) {
                throw new Error(`Product not found: ${product_id}`);
              }

              if (deleted === false) {
                throw new Error(`Product has linked stock lots/sales`);
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

      // 6. Sync Stock Lots (depends on: product, supplier, color, size)
      // Only CREATE operation supported - no UPDATE/DELETE
      if (stock_lots && stock_lots.length > 0) {
        for (const lot of stock_lots) {
          try {
            // CHECK IDEMPOTENCY
            const existing = await this.findByIdempotencyKey(
              owner_id,
              "clothing_stock_lot",
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

              const color_id =
                result.id_mapping[lot.color_id?.toString()] || lot.color_id;

              const size_id =
                result.id_mapping[lot.size_id?.toString()] || lot.size_id;

              // VALIDATE PRODUCT
              const productExists = await prisma.clothingProduct.findFirst({
                where: {
                  product_id,
                  owner_id,
                },
              });

              if (!productExists) {
                throw new Error(`Invalid product mapping: ${product_id}`);
              }

              // VALIDATE SUPPLIER
              const supplierExists = await prisma.clothingSupplier.findFirst({
                where: {
                  supplier_id,
                  owner_id,
                },
              });

              if (!supplierExists) {
                throw new Error(`Invalid supplier mapping: ${supplier_id}`);
              }

              // VALIDATE COLOR
              const colorExists = await prisma.clothingColor.findFirst({
                where: { color_id },
              });

              if (!colorExists) {
                throw new Error(`Invalid color mapping: ${color_id}`);
              }

              // VALIDATE SIZE
              const sizeExists = await prisma.clothingSize.findFirst({
                where: { size_id },
              });

              if (!sizeExists) {
                throw new Error(`Invalid size mapping: ${size_id}`);
              }

              // OPTIONAL DUPLICATE CHECK
              const duplicate = await prisma.clothingStockLot.findFirst({
                where: {
                  product_id,
                  supplier_id,
                  color_id,
                  size_id,
                },
              });

              // DUPLICATE FOUND
              if (duplicate) {
                await this.saveIdempotencyKey(
                  owner_id,
                  "clothing_stock_lot",
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
                const created = await clothingStockLotService.bulkCreate(
                  owner_id,
                  {
                    product_id,
                    supplier_id,
                    cp: lot.cp,
                    sp: lot.sp,
                    notes: lot.notes,
                    variants: [
                      {
                        color_id,
                        sizes: [
                          {
                            size_id,
                            qty_in: lot.qty_in,
                          },
                        ],
                      },
                    ],
                  },
                );

                // SAVE IDEMPOTENCY
                await this.saveIdempotencyKey(
                  owner_id,
                  "clothing_stock_lot",
                  lot.local_id,
                  created.lots[0].lot_id,
                );

                result.synced.stock_lots.push({
                  local_id: lot.local_id,
                  server_id: created.lots[0].lot_id,
                  status: "created",
                });

                result.id_mapping[lot.local_id] = created.lots[0].lot_id;
              }
            }
          } catch (err) {
            result.failed.push({
              type: "stock_lot",
              local_id: lot.local_id,
              operation: "create",
              error: err.message,
            });
          }
        }
      }

      // 7. Sync Sales (depends on: product)
      // Only CREATE operation supported - no UPDATE/DELETE
      if (sales && sales.length > 0) {
        for (const s of sales) {
          try {
            // CHECK IDEMPOTENCY
            const existing = await this.findByIdempotencyKey(
              owner_id,
              "clothing_sale",
              s.local_id,
            );

            // ALREADY SYNCED
            if (existing) {
              result.synced.sales.push({
                local_id: s.local_id,
                server_id: existing.sales_id,
                status: "already_synced",
              });

              result.id_mapping[s.local_id] = existing.sales_id;
            } else {
              // MAP LOCAL IDS
              const items = s.items.map((item) => ({
                product_id:
                  result.id_mapping[item.product_id?.toString()] ||
                  item.product_id,
                lot_id:
                  result.id_mapping[item.lot_id?.toString()] || item.lot_id,
                size_id:
                  result.id_mapping[item.size_id?.toString()] || item.size_id,
                color_id:
                  result.id_mapping[item.color_id?.toString()] ||
                  item.color_id,
                qty: item.qty,
                sp: item.sp,
                note: item.note,
              }));

              // CREATE SALE
              const created = await clothingSalesService.createSale(owner_id, {
                customer: s.customer,
                paid_amount: s.paid_amount || 0,
                payment_status: s.payment_status,
                note: s.note,
                items,
              });

              // SAVE IDEMPOTENCY
              await this.saveIdempotencyKey(
                owner_id,
                "clothing_sale",
                s.local_id,
                created.sales_id,
              );

              result.synced.sales.push({
                local_id: s.local_id,
                server_id: created.sales_id,
                status: "created",
              });

              result.id_mapping[s.local_id] = created.sales_id;
            }
          } catch (err) {
            result.failed.push({
              type: "sale",
              local_id: s.local_id,
              operation: "create",
              error: err.message,
            });
          }
        }
      }

      // 8. Sync Returns (depends on: product)
      // Only CREATE operation supported - no UPDATE/DELETE
      if (returns && returns.length > 0) {
        for (const ret of returns) {
          try {
            // CHECK IDEMPOTENCY
            const existing = await this.findByIdempotencyKey(
              owner_id,
              "clothing_return",
              ret.local_id,
            );

            // ALREADY SYNCED
            if (existing) {
              result.synced.returns.push({
                local_id: ret.local_id,
                server_id: existing.return_id,
                status: "already_synced",
              });

              result.id_mapping[ret.local_id] = existing.return_id;
            } else {
              // MAP LOCAL IDS
              const sales_id =
                result.id_mapping[ret.sales_id?.toString()] || ret.sales_id;

              // CREATE RETURN
              const created = await clothingCustomerReturnService.createReturn(
                owner_id,
                {
                  sales_id,
                  note: ret.note,
                  items: ret.items,
                },
              );

              // SAVE IDEMPOTENCY
              await this.saveIdempotencyKey(
                owner_id,
                "clothing_return",
                ret.local_id,
                created.return.return_id,
              );

              result.synced.returns.push({
                local_id: ret.local_id,
                server_id: created.return.return_id,
                status: "created",
              });

              result.id_mapping[ret.local_id] = created.return.return_id;
            }
          } catch (err) {
            result.failed.push({
              type: "return",
              local_id: ret.local_id,
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

export default new ClothingBatchSyncService();
