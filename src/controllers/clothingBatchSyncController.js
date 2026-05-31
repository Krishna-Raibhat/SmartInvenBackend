// src/controllers/clothingBatchSyncController.js
import service from "../services/clothingBatchSyncService.js";

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

export const batchSync = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const {
      categories,
      colors,
      sizes,
      suppliers,
      products,
      stock_lots,
      sales,
      returns,
    } = req.body;

    // Validate at least one entity type is provided
    if (
      !categories &&
      !colors &&
      !sizes &&
      !suppliers &&
      !products &&
      !stock_lots &&
      !sales &&
      !returns
    ) {
      return fail(
        res,
        400,
        "VALIDATION_NO_DATA",
        "At least one entity type is required"
      );
    }

    const result = await service.batchSync(owner_id, {
      categories,
      colors,
      sizes,
      suppliers,
      products,
      stock_lots,
      sales,
      returns,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("Error in batch sync:", err);
    if (err.status) return fail(res, err.status, err.code || "ERROR", err.message);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};
