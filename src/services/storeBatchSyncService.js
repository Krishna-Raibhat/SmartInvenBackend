// src/services/storeBatchSyncService.js
import { prisma } from "../prisma/client.js";
import storeCategoryService from "./storeCategoryService.js";
import storeUnitService from "./storeUnitService.js";
import storeSupplierService from "./storeSupplierService.js";
import storeProductService from "./storeProductService.js";
import storeStockLotService from "./storeStockLotService.js";
import storeSalesService from "./storeSalesService.js";
import storeCustomerReturnService from "./storeCustomerReturnService.js";
import storeSupplierReturnService from "./storeSupplierReturnService.js";
import { expenseTitleService, expenseService } from "./storeExpenseService.js";

class StoreBatchSyncService {
  /**
   * Batch sync multiple items in correct order
   * Handles CREATE, UPDATE, DELETE for master data (categories, units, suppliers, products, expense titles)
   * Handles CREATE only for transactional data (stock_lots, sales, credit_payments, returns, expenses*)
   * Delegates all business rules to the existing single-record services.
   */
  async batchSync(
    owner_id,
    {
      categories,
      units,
      suppliers,
      products,
      stock_lots,
      sales,
      credit_payments,
      customer_returns,
      supplier_returns,
      expense_titles,
      expenses,
    },
  ) {
    const result = {
      synced: {
        categories: [],
        units: [],
        suppliers: [],
        products: [],
        stock_lots: [],
        sales: [],
        credit_payments: [],
        customer_returns: [],
        supplier_returns: [],
        expense_titles: [],
        expenses: [],
      },
      failed: [],
      id_mapping: {},
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
                "store_category",
                cat.local_id,
              );

              if (existing) {
                result.synced.categories.push({
                  local_id: cat.local_id,
                  server_id: existing.category_id,
                  status: "already_synced",
                });
                result.id_mapping[cat.local_id] = existing.category_id;
                continue;
              }

              try {
                const created = await storeCategoryService.create({
                  owner_id,
                  category_name: cat.category_name,
                });

                await this.saveIdempotencyKey(
                  owner_id,
                  "store_category",
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
              } catch (svcErr) {
                if (svcErr.code === "DUPLICATE") {
                  const category_name = String(cat.category_name).trim().toLowerCase();
                  const duplicate = await prisma.storeCategory.findFirst({
                    where: { owner_id, category_name },
                  });
                  if (!duplicate) throw svcErr;

                  await this.saveIdempotencyKey(
                    owner_id,
                    "store_category",
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
                } else if (svcErr.code === "FORBIDDEN") {
                  const general = await prisma.storeCategory.findFirst({
                    where: { owner_id, category_name: "general" },
                  });
                  if (!general) throw svcErr;

                  await this.saveIdempotencyKey(
                    owner_id,
                    "store_category",
                    cat.local_id,
                    general.category_id,
                    "create",
                  );

                  result.synced.categories.push({
                    local_id: cat.local_id,
                    server_id: general.category_id,
                    status: "duplicate_merged",
                  });
                  result.id_mapping[cat.local_id] = general.category_id;
                } else {
                  throw svcErr;
                }
              }
            } else if (operation === "update") {
              const category_id = cat.category_id || cat.local_id;
              const updated = await storeCategoryService.update(owner_id, category_id, {
                category_name: cat.category_name,
              });

              result.synced.categories.push({
                local_id: cat.local_id,
                server_id: updated.category_id,
                status: "updated",
              });
            } else if (operation === "delete") {
              const category_id = cat.category_id || cat.local_id;
              await storeCategoryService.delete(owner_id, category_id);

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

      // 2. Sync Units (no dependencies)
      if (units && units.length > 0) {
        for (const unit of units) {
          try {
            const operation = unit.operation || "create";

            if (operation === "create") {
              const existing = await this.findByIdempotencyKey(
                owner_id,
                "store_unit",
                unit.local_id,
              );

              if (existing) {
                result.synced.units.push({
                  local_id: unit.local_id,
                  server_id: existing.unit_id,
                  status: "already_synced",
                });
                result.id_mapping[unit.local_id] = existing.unit_id;
                continue;
              }

              try {
                const created = await storeUnitService.create({
                  owner_id,
                  unit_name: unit.unit_name,
                });

                await this.saveIdempotencyKey(
                  owner_id,
                  "store_unit",
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
              } catch (svcErr) {
                if (svcErr.code === "DUPLICATE") {
                  const unit_name = String(unit.unit_name).trim().toLowerCase();
                  const duplicate = await prisma.storeUnit.findFirst({
                    where: { owner_id, unit_name },
                  });
                  if (!duplicate) throw svcErr;

                  await this.saveIdempotencyKey(
                    owner_id,
                    "store_unit",
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
                  throw svcErr;
                }
              }
            } else if (operation === "update") {
              const unit_id = unit.unit_id || unit.local_id;
              const updated = await storeUnitService.update(owner_id, unit_id, {
                unit_name: unit.unit_name,
              });

              result.synced.units.push({
                local_id: unit.local_id,
                server_id: updated.unit_id,
                status: "updated",
              });
            } else if (operation === "delete") {
              const unit_id = unit.unit_id || unit.local_id;
              await storeUnitService.delete(owner_id, unit_id);

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

      // 3. Sync Suppliers (no dependencies)
      if (suppliers && suppliers.length > 0) {
        for (const supplier of suppliers) {
          try {
            const operation = supplier.operation || "create";

            if (operation === "create") {
              const existing = await this.findByIdempotencyKey(
                owner_id,
                "store_supplier",
                supplier.local_id,
              );

              if (existing) {
                result.synced.suppliers.push({
                  local_id: supplier.local_id,
                  server_id: existing.supplier_id,
                  status: "already_synced",
                });
                result.id_mapping[supplier.local_id] = existing.supplier_id;
                continue;
              }

              try {
                const created = await storeSupplierService.create({
                  owner_id,
                  supplier_name: supplier.supplier_name,
                  phone: supplier.phone,
                  email: supplier.email,
                  address: supplier.address,
                });

                await this.saveIdempotencyKey(
                  owner_id,
                  "store_supplier",
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
              } catch (svcErr) {
                if (svcErr.code === "DUPLICATE") {
                  const phone = String(supplier.phone).trim();
                  const duplicate = await prisma.storeSupplier.findFirst({
                    where: { owner_id, phone },
                  });
                  if (!duplicate) throw svcErr;

                  await this.saveIdempotencyKey(
                    owner_id,
                    "store_supplier",
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
                  throw svcErr;
                }
              }
            } else if (operation === "update") {
              const supplier_id = supplier.supplier_id || supplier.local_id;
              const updated = await storeSupplierService.update(owner_id, supplier_id, {
                supplier_name: supplier.supplier_name,
                phone: supplier.phone,
                email: supplier.email,
                address: supplier.address,
              });

              result.synced.suppliers.push({
                local_id: supplier.local_id,
                server_id: updated.supplier_id,
                status: "updated",
              });
            } else if (operation === "delete") {
              const supplier_id = supplier.supplier_id || supplier.local_id;
              // NOTE: service method is `remove`, not `delete`.
              await storeSupplierService.remove(owner_id, supplier_id);

              result.synced.suppliers.push({
                local_id: supplier.local_id,
                server_id: supplier_id,
                status: "deleted",
              });
            }
            // setDue / recordPayment are not sync operations — they're live
            // financial actions, not offline-queueable master-data writes.
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

      // 4. Sync Products (depends on: category_id, unit_id)
      if (products && products.length > 0) {
        for (const product of products) {
          try {
            const operation = product.operation || "create";

            if (operation === "create") {
              const existing = await this.findByIdempotencyKey(
                owner_id,
                "store_product",
                product.local_id,
              );

              if (existing) {
                result.synced.products.push({
                  local_id: product.local_id,
                  server_id: existing.product_id,
                  status: "already_synced",
                });
                result.id_mapping[product.local_id] = existing.product_id;
                continue;
              }

              const category_id = product.category_id
                ? result.id_mapping[product.category_id] || product.category_id
                : null;
              const unit_id = product.unit_id
                ? result.id_mapping[product.unit_id] || product.unit_id
                : null;

              try {
                const created = await storeProductService.create({
                  owner_id,
                  category_id,
                  unit_id,
                  product_name: product.product_name,
                  type: product.type || "item",
                  description: product.description,
                  cp: product.cp,
                  sp: product.sp,
                });

                await this.saveIdempotencyKey(
                  owner_id,
                  "store_product",
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
              } catch (svcErr) {
                if (svcErr.code === "DUPLICATE") {
                  const product_name = String(product.product_name).trim();
                  const duplicate = await prisma.storeProduct.findFirst({
                    where: { owner_id, product_name },
                  });
                  if (!duplicate) throw svcErr;

                  await this.saveIdempotencyKey(
                    owner_id,
                    "store_product",
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
                  throw svcErr;
                }
              }
            } else if (operation === "update") {
              const product_id = product.product_id || product.local_id;

              const category_id = product.category_id
                ? result.id_mapping[product.category_id] || product.category_id
                : undefined;
              const unit_id = product.unit_id
                ? result.id_mapping[product.unit_id] || product.unit_id
                : undefined;

              const updated = await storeProductService.update(owner_id, product_id, {
                category_id,
                unit_id,
                product_name: product.product_name,
                type: product.type,
                description: product.description,
                cp: product.cp,
                sp: product.sp,
              });

              result.synced.products.push({
                local_id: product.local_id,
                server_id: updated.product_id,
                status: "updated",
              });
            } else if (operation === "delete") {
              const product_id = product.product_id || product.local_id;
              await storeProductService.delete(owner_id, product_id);

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

      // 5. Sync Stock Lots (depends on: product_id, supplier_id) — CREATE ONLY
      if (stock_lots && stock_lots.length > 0) {
        for (const lot of stock_lots) {
          try {
            const existing = await this.findByIdempotencyKey(
              owner_id,
              "store_stock_lot",
              lot.local_id,
            );

            if (existing) {
              result.synced.stock_lots.push({
                local_id: lot.local_id,
                server_id: existing.lot_id,
                status: "already_synced",
              });
              result.id_mapping[lot.local_id] = existing.lot_id;
              continue;
            }

            const product_id = result.id_mapping[lot.product_id] || lot.product_id;
            const supplier_id = result.id_mapping[lot.supplier_id] || lot.supplier_id;

            const created = await storeStockLotService.create({
              owner_id,
              product_id,
              supplier_id,
              qty_in: lot.qty_in,
              cp: lot.cp,
              sp: lot.sp,
            });

            await this.saveIdempotencyKey(
              owner_id,
              "store_stock_lot",
              lot.local_id,
              created.lot_id,
              "create",
            );

            result.synced.stock_lots.push({
              local_id: lot.local_id,
              server_id: created.lot_id,
              status: "created",
            });
            result.id_mapping[lot.local_id] = created.lot_id;
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

      // 6. Sync Sales (depends on: product_id, lot_id, customer_id) — CREATE ONLY
      if (sales && sales.length > 0) {
        for (const sale of sales) {
          try {
            const existing = await this.findByIdempotencyKey(
              owner_id,
              "store_sale",
              sale.local_id,
            );

            if (existing) {
              result.synced.sales.push({
                local_id: sale.local_id,
                server_id: existing.sale_id,
                status: "already_synced",
              });
              result.id_mapping[sale.local_id] = existing.sale_id;
              continue;
            }

            const customer_id = sale.customer_id
              ? result.id_mapping[sale.customer_id] || sale.customer_id
              : null;

            const items = (sale.items || []).map((item) => ({
              product_id: result.id_mapping[item.product_id] || item.product_id,
              lot_id: item.lot_id
                ? result.id_mapping[item.lot_id] || item.lot_id
                : undefined,
              qty: item.qty,
              sp: item.sp,
              note: item.note,
            }));

            const created = await storeSalesService.createSale(owner_id, {
              customer_id,
              customer: sale.customer,
              paid_amount: sale.paid_amount,
              payment_status: sale.payment_status,
              payment_method: sale.payment_method,
              discount: sale.discount,
              note: sale.note,
              items,
            });

            await this.saveIdempotencyKey(
              owner_id,
              "store_sale",
              sale.local_id,
              created.sales_id,
              "create",
            );

            result.synced.sales.push({
              local_id: sale.local_id,
              server_id: created.sales_id,
              status: "created",
              due_amount: created.due_amount,
              payment_status: created.payment_status,
            });
            result.id_mapping[sale.local_id] = created.sales_id;
          } catch (err) {
            result.failed.push({
              type: "sale",
              local_id: sale.local_id,
              operation: "create",
              error: err.message,
            });
          }
        }
      }

      // 7. Sync Credit Payments (depends on: sales_id) — CREATE ONLY
      if (credit_payments && credit_payments.length > 0) {
        for (const payment of credit_payments) {
          try {
            const existing = await this.findByIdempotencyKey(
              owner_id,
              "store_credit_payment",
              payment.local_id,
            );

            if (existing) {
              result.synced.credit_payments.push({
                local_id: payment.local_id,
                server_id: existing.payment_id,
                status: "already_synced",
              });
              result.id_mapping[payment.local_id] = existing.payment_id; // fixed: was missing
              continue;
            }

            const sales_id = result.id_mapping[payment.sales_id] || payment.sales_id;

            const updated = await storeSalesService.addPayment(
              owner_id,
              sales_id,
              payment.amount,
              payment.payment_method,
            );

            await this.saveIdempotencyKey(
              owner_id,
              "store_credit_payment",
              payment.local_id,
              sales_id,
              "create",
            );

            result.synced.credit_payments.push({
              local_id: payment.local_id,
              server_id: sales_id,
              status: "created",
              due_amount: updated.due_amount,
              payment_status: updated.payment_status,
            });
            result.id_mapping[payment.local_id] = sales_id;
          } catch (err) {
            result.failed.push({
              type: "credit_payment",
              local_id: payment.local_id,
              operation: "create",
              error: err.message,
            });
          }
        }
      }

      // 8. Sync Customer Returns (depends on: sales_id, sales_item_id) — CREATE ONLY
      if (customer_returns && customer_returns.length > 0) {
        for (const ret of customer_returns) {
          try {
            const existing = await this.findByIdempotencyKey(
              owner_id,
              "store_customer_return",
              ret.local_id,
            );

            if (existing) {
              result.synced.customer_returns.push({
                local_id: ret.local_id,
                server_id: existing.return_id,
                status: "already_synced",
              });
              result.id_mapping[ret.local_id] = existing.return_id;
              continue;
            }

            const sales_id = result.id_mapping[ret.sales_id] || ret.sales_id;

            const items = (ret.items || []).map((item) => ({
              sales_item_id:
                result.id_mapping[item.sales_item_id] || item.sales_item_id,
              qty: item.qty,
              amount: item.amount,
              note: item.note,
            }));

            const created = await storeCustomerReturnService.createReturn(owner_id, {
              sales_id,
              note: ret.note,
              items,
            });

            const return_id = created.return.return_id;

            await this.saveIdempotencyKey(
              owner_id,
              "store_customer_return",
              ret.local_id,
              return_id,
              "create",
            );

            result.synced.customer_returns.push({
              local_id: ret.local_id,
              server_id: return_id,
              status: "created",
              refund_amount: created.sale_info.refund_amount,
              due_amount: created.sale_info.due_amount,
            });
            result.id_mapping[ret.local_id] = return_id;
          } catch (err) {
            result.failed.push({
              type: "customer_return",
              local_id: ret.local_id,
              operation: "create",
              error: err.message,
            });
          }
        }
      }

      // 9. Sync Supplier Returns (depends on: supplier_id, lot_id) — CREATE ONLY
      if (supplier_returns && supplier_returns.length > 0) {
        for (const ret of supplier_returns) {
          try {
            const existing = await this.findByIdempotencyKey(
              owner_id,
              "store_supplier_return",
              ret.local_id,
            );

            if (existing) {
              result.synced.supplier_returns.push({
                local_id: ret.local_id,
                server_id: existing.return_id,
                status: "already_synced",
              });
              result.id_mapping[ret.local_id] = existing.return_id;
              continue;
            }

            const supplier_id =
              result.id_mapping[ret.supplier_id] || ret.supplier_id;

            const items = (ret.items || []).map((item) => ({
              lot_id: result.id_mapping[item.lot_id] || item.lot_id,
              qty: item.qty,
              reason: item.reason,
              note: item.note,
            }));

            const created = await storeSupplierReturnService.createReturn(owner_id, {
              supplier_id,
              note: ret.note,
              items,
            });

            await this.saveIdempotencyKey(
              owner_id,
              "store_supplier_return",
              ret.local_id,
              created.return_id,
              "create",
            );

            result.synced.supplier_returns.push({
              local_id: ret.local_id,
              server_id: created.return_id,
              status: "created",
              total_refund: Number(created.total_refund),
            });
            result.id_mapping[ret.local_id] = created.return_id;
          } catch (err) {
            result.failed.push({
              type: "supplier_return",
              local_id: ret.local_id,
              operation: "create",
              error: err.message,
            });
          }
        }
      }

      // 10. Sync Expense Titles (no dependencies)
      if (expense_titles && expense_titles.length > 0) {
        for (const title of expense_titles) {
          try {
            const operation = title.operation || "create";

            if (operation === "create") {
              const existing = await this.findByIdempotencyKey(
                owner_id,
                "store_expense_title",
                title.local_id,
              );

              if (existing) {
                result.synced.expense_titles.push({
                  local_id: title.local_id,
                  server_id: existing.title_id,
                  status: "already_synced",
                });
                result.id_mapping[title.local_id] = existing.title_id;
                continue;
              }

              try {
                const created = await expenseTitleService.create(owner_id, {
                  title: title.title,
                });

                await this.saveIdempotencyKey(
                  owner_id,
                  "store_expense_title",
                  title.local_id,
                  created.title_id,
                  "create",
                );

                result.synced.expense_titles.push({
                  local_id: title.local_id,
                  server_id: created.title_id,
                  status: "created",
                });
                result.id_mapping[title.local_id] = created.title_id;
              } catch (svcErr) {
                if (svcErr.code === "DUPLICATE") {
                  const titleName = String(title.title).trim();
                  const duplicate = await prisma.storeExpenseTitle.findFirst({
                    where: { owner_id, title: titleName },
                  });
                  if (!duplicate) throw svcErr;

                  await this.saveIdempotencyKey(
                    owner_id,
                    "store_expense_title",
                    title.local_id,
                    duplicate.title_id,
                    "create",
                  );

                  result.synced.expense_titles.push({
                    local_id: title.local_id,
                    server_id: duplicate.title_id,
                    status: "duplicate_merged",
                  });
                  result.id_mapping[title.local_id] = duplicate.title_id;
                } else {
                  throw svcErr;
                }
              }
            } else if (operation === "update") {
              const title_id = title.title_id || title.local_id;
              const updated = await expenseTitleService.update(owner_id, title_id, {
                title: title.title,
              });

              result.synced.expense_titles.push({
                local_id: title.local_id,
                server_id: updated.title_id,
                status: "updated",
              });
            } else if (operation === "delete") {
              const title_id = title.title_id || title.local_id;
              await expenseTitleService.delete(owner_id, title_id);

              result.synced.expense_titles.push({
                local_id: title.local_id,
                server_id: title_id,
                status: "deleted",
              });
            }
          } catch (err) {
            result.failed.push({
              type: "expense_title",
              local_id: title.local_id,
              operation: title.operation || "create",
              error: err.message,
            });
          }
        }
      }

      // 11. Sync Expenses (depends on: title_id)
      if (expenses && expenses.length > 0) {
        for (const expense of expenses) {
          try {
            const operation = expense.operation || "create";

            if (operation === "create") {
              const existing = await this.findByIdempotencyKey(
                owner_id,
                "store_expense",
                expense.local_id,
              );

              if (existing) {
                result.synced.expenses.push({
                  local_id: expense.local_id,
                  server_id: existing.expense_id,
                  status: "already_synced",
                });
                result.id_mapping[expense.local_id] = existing.expense_id;
                continue;
              }

              const title_id =
                result.id_mapping[expense.title_id] || expense.title_id;

              const created = await expenseService.create(owner_id, {
                title_id,
                amount: expense.amount,
                note: expense.note,
              });

              await this.saveIdempotencyKey(
                owner_id,
                "store_expense",
                expense.local_id,
                created.expense_id,
                "create",
              );

              result.synced.expenses.push({
                local_id: expense.local_id,
                server_id: created.expense_id,
                status: "created",
              });
              result.id_mapping[expense.local_id] = created.expense_id;
            } else if (operation === "update") {
              const expense_id = expense.expense_id || expense.local_id;

              const title_id = expense.title_id
                ? result.id_mapping[expense.title_id] || expense.title_id
                : undefined;

              const updated = await expenseService.update(owner_id, expense_id, {
                title_id,
                amount: expense.amount,
                note: expense.note,
              });

              result.synced.expenses.push({
                local_id: expense.local_id,
                server_id: updated.expense_id,
                status: "updated",
              });
            } else if (operation === "delete") {
              const expense_id = expense.expense_id || expense.local_id;
              await expenseService.delete(owner_id, expense_id);

              result.synced.expenses.push({
                local_id: expense.local_id,
                server_id: expense_id,
                status: "deleted",
              });
            }
          } catch (err) {
            result.failed.push({
              type: "expense",
              local_id: expense.local_id,
              operation: expense.operation || "create",
              error: err.message,
            });
          }
        }
      }

      // Single, gated credit summary — computed once, only if relevant data was in this batch
      if (sales?.length || credit_payments?.length) {
        const credit = await storeSalesService.listCredit(owner_id, { page: 1, limit: 100 });
        result.credit_summary = credit.data;
      }

      return result;
    } catch (err) {
      console.error("❌ Store batch sync error:", err);
      throw err;
    }
  }

  async findByIdempotencyKey(owner_id, entity_type, local_id) {
    const record = await prisma.syncIdempotency.findUnique({
      where: {
        owner_id_entity_type_local_id: { owner_id, entity_type, local_id },
      },
    });

    if (!record) return null;
    return { [entity_type.split("_").pop() + "_id"]: record.server_id };
  }

  async saveIdempotencyKey(owner_id, entity_type, local_id, server_id, operation = "create") {
    return prisma.syncIdempotency.upsert({
      where: {
        owner_id_entity_type_local_id: { owner_id, entity_type, local_id },
      },
      update: { server_id, operation, last_synced_at: new Date() },
      create: { owner_id, entity_type, local_id, server_id, operation },
    });
  }
}

export default new StoreBatchSyncService();