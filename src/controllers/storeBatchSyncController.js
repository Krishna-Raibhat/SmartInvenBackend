// src/controllers/storeBatchSyncController.js
import service from "../services/storeBatchSyncService.js";
import { prisma } from "../prisma/client.js";

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

export const batchSync = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { categories, units, suppliers } = req.body;

    if (!categories && !units && !suppliers) {
      return fail(
        res,
        400,
        "VALIDATION_NO_DATA",
        "At least one entity type is required",
      );
    }

    const result = await service.batchSync(owner_id, { categories, units, suppliers });

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("Error in store batch sync:", err);
    if (err.status) return fail(res, err.status, err.code || "ERROR", err.message);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

// GET /api/store/sync/master-data
// Returns categories + units + suppliers in one call for initial load / post-sync refresh
export const getMasterData = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;

    const [categories, units, suppliers] = await Promise.all([
      prisma.storeCategory.findMany({
        where: { owner_id },
        orderBy: { category_name: "asc" },
        select: { category_id: true, category_name: true, created_at: true, updated_at: true },
      }),
      prisma.storeUnit.findMany({
        where: { owner_id },
        orderBy: { unit_name: "asc" },
        select: { unit_id: true, unit_name: true, created_at: true, updated_at: true },
      }),
      prisma.storeSupplier.findMany({
        where: { owner_id },
        orderBy: { created_at: "desc" },
        select: {
          supplier_id: true,
          supplier_name: true,
          phone: true,
          email: true,
          address: true,
          due_amount: true,
          paid_amount: true,
          payment_status: true,
          created_at: true,
          updated_at: true,
        },
      }),
    ]);

    return res.json({
      success: true,
      data: { categories, units, suppliers },
    });
  } catch (err) {
    console.error("Error fetching store master data:", err);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};