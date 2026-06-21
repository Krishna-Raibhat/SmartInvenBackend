// src/services/storeBatchSyncService.js
import { prisma } from "../prisma/client.js";
import { Prisma } from "@prisma/client";
import storeCategoryService from "./storeCategoryService.js";
import storeUnitService from "./storeUnitService.js";
import storeSupplierService from "./storeSupplierService.js";

class StoreBatchSyncService {
  /**
   * Batch sync multiple items in correct order
   * Handles CREATE, UPDATE, DELETE for master data (categories, units, suppliers, ...)
   * Delegates all business rules to the existing single-record services.
   */
  async batchSync(owner_id, { categories, units, suppliers }) {
    const result = {
      synced: { categories: [], units: [], suppliers: [] },
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
                  // Unique constraint is [owner_id, phone] — look it up by phone, not name.
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
            // Deliberately not handled here.
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