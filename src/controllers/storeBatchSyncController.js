// src/controllers/storeBatchSyncController.js
import service from "../services/storeBatchSyncService.js";
import storeCategoryService from "../services/storeCategoryService.js";
import storeUnitService from "../services/storeUnitService.js";
import storeSupplierService from "../services/storeSupplierService.js";
import storeProductService from "../services/storeProductService.js";
import storeStockLotService from "../services/storeStockLotService.js";
import storeSalesService from "../services/storeSalesService.js";
import storeCustomerReturnService from "../services/storeCustomerReturnService.js";
import storeSupplierReturnService from "../services/storeSupplierReturnService.js";
import { expenseTitleService, expenseService } from "../services/storeExpenseService.js";

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

// ─────────────────────────────────────────────
// POST /api/store/sync  — push offline changes
// ─────────────────────────────────────────────
export const batchSync = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const {
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
    } = req.body;

    if (
      !categories && !units && !suppliers && !products && !stock_lots &&
      !sales && !credit_payments && !customer_returns &&
      !supplier_returns && !expense_titles && !expenses
    ) {
      return fail(
        res,
        400,
        "VALIDATION_NO_DATA",
        "At least one entity type is required",
      );
    }

    const result = await service.batchSync(owner_id, {
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
    });

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("Error in store batch sync:", err);
    if (err.status) return fail(res, err.status, err.code || "ERROR", err.message);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

// ─────────────────────────────────────────────
// GET /api/store/sync/master-data  — full pull
// Returns every entity type in one call, for initial load / post-sync refresh.
//
// Caps to be aware of:
//   - sales & expenses are paginated services → capped at FULL_SYNC_LIMIT here
//   - credit (outstanding dues) is paginated → capped at CREDIT_LIMIT here
//   - customer_returns is capped inside its own service (take: 100)
//   - supplier_returns is capped inside its own service (take: 200)
// If any store exceeds these caps, this becomes a partial pull, not a full one.
// A proper fix later would be delta sync (since last_synced_at) rather than
// raising these numbers indefinitely.
// ─────────────────────────────────────────────
const FULL_SYNC_LIMIT = 500;
const CREDIT_LIMIT = 200;

export const getMasterData = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;

    const [
      categories,
      units,
      suppliers,
      products,
      stock_lots,
      salesResult,
      creditResult,
      customer_returns,
      supplier_returns,
      expense_titles,
      expensesResult,
    ] = await Promise.all([
      storeCategoryService.list(owner_id),
      storeUnitService.list(owner_id),
      storeSupplierService.list(owner_id),
      storeProductService.list(owner_id),
      storeStockLotService.list(owner_id),
      storeSalesService.list(owner_id, { page: 1, limit: FULL_SYNC_LIMIT }),
      storeSalesService.listCredit(owner_id, { page: 1, limit: CREDIT_LIMIT }),
      storeCustomerReturnService.list(owner_id),
      storeSupplierReturnService.list(owner_id),
      expenseTitleService.list(owner_id),
      expenseService.list(owner_id, { page: 1, limit: FULL_SYNC_LIMIT }),
    ]);

    return res.json({
      success: true,
      data: {
        categories,
        units,
        suppliers,
        products,
        stock_lots,

        sales: salesResult.data,
        sales_meta: {
          total: salesResult.total,
          page: salesResult.page,
          limit: salesResult.limit,
          totalPages: salesResult.totalPages,
        },

        credit: creditResult.data,
        credit_meta: {
          total: creditResult.total,
          page: creditResult.page,
          limit: creditResult.limit,
          totalPages: creditResult.totalPages,
        },

        customer_returns,
        supplier_returns,

        expense_titles,
        expenses: expensesResult.data,
        expenses_meta: {
          total: expensesResult.total,
          page: expensesResult.page,
          limit: expensesResult.limit,
          totalPages: expensesResult.totalPages,
        },
      },
    });
  } catch (err) {
    console.error("Error fetching store full sync data:", err);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};