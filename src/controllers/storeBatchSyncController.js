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


// GET /api/store/sync/stock-lots/product/:product_id
export const getStockLotsByProduct = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { product_id } = req.params;

    if (!product_id) {
      return fail(res, 400, "VALIDATION_NO_DATA", "product_id is required");
    }

    const lots = await storeStockLotService.getByProduct(owner_id, product_id);

    return res.json({ success: true, data: lots });
  } catch (err) {
    console.error("Error fetching stock lots by product:", err);
    if (err.code === "PRODUCT_NOT_FOUND") return fail(res, 404, err.code, err.message);
    if (err.code === "VALIDATION_ERROR") return fail(res, 400, err.code, err.message);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

// GET /api/store/sync/stock-lots/supplier/:supplier_id
export const getStockLotsBySupplier = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { supplier_id } = req.params;

    if (!supplier_id) {
      return fail(res, 400, "VALIDATION_NO_DATA", "supplier_id is required");
    }

    const lots = await storeSupplierService.getLots(owner_id, supplier_id);

    return res.json({ success: true, data: lots });
  } catch (err) {
    console.error("Error fetching stock lots by supplier:", err);
    if (err.code === "NOT_FOUND") return fail(res, 404, err.code, err.message);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

// GET /api/store/sync/sales
export const getSalesList = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { page, limit } = req.query;

    const result = await storeSalesService.list(owner_id, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error("Error fetching sales list:", err);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

// GET /api/store/sync/sales/:sales_id
export const getSaleById = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { sales_id } = req.params;

    if (!sales_id) {
      return fail(res, 400, "VALIDATION_NO_DATA", "sales_id is required");
    }

    const sale = await storeSalesService.getById(owner_id, sales_id);

    return res.json({ success: true, data: sale });
  } catch (err) {
    console.error("Error fetching sale by id:", err);
    if (err.code === "SALE_NOT_FOUND") return fail(res, 404, err.code, err.message);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

// GET /api/store/sync/customer-returns
export const getCustomerReturnsList = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const returns = await storeCustomerReturnService.list(owner_id);

    return res.json({ success: true, data: returns });
  } catch (err) {
    console.error("Error fetching customer returns list:", err);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

export const getCreditList = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { page, limit } = req.query;

    const result = await storeSalesService.listCredit(owner_id, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error("Error fetching credit list:", err);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

export const getProductsByIds = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { product_ids } = req.body;

    const products = [];
    const not_found = [];

    for (const product_id of product_ids) {
      try {
        const product = await storeProductService.getById(owner_id, product_id);
        products.push(product);
      } catch (err) {
        if (err.code === "NOT_FOUND") {
          not_found.push(product_id);
        } else {
          throw err;
        }
      }
    }

    return res.json({ success: true, data: { products, not_found } });
  } catch (err) {
    console.error("Error fetching products by ids:", err);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};