// src/controllers/groceryBatchSyncController.js
import groceryBatchSyncService from "../services/groceryBatchSyncService.js";

export const batchSync = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { categories, brands, units, suppliers, products, stock_lots, sales, returns } = req.body;

    const result = await groceryBatchSyncService.batchSync(owner_id, {
      categories,
      brands,
      units,
      suppliers,
      products,
      stock_lots,
      sales,
      returns,
    });

    return res.status(200).json({
      success: true,
      message: "Batch sync completed",
      data: result,
    });
  } catch (err) {
    console.error("❌ Batch sync error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Batch sync failed",
    });
  }
};

export const getSyncStatus = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { items } = req.body; // Array of {entity_type, local_id}

    const result = await groceryBatchSyncService.getSyncStatus(owner_id, items);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("❌ Get sync status error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to get sync status",
    });
  }
};
