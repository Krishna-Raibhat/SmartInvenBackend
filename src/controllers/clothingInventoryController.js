import service from "../services/clothingInventoryService.js";

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

export const listProducts = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { search, category_id } = req.query;

    const data = await service.listProducts(owner_id, { search, category_id });
    return res.json({ success: true, data });
  } catch (e) {
    return fail(res, e.status || 500, e.code || "SERVER_ERROR", e.message);
  }
};

export const getProductDetails = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { product_id } = req.params;

    const data = await service.getProductDetails(owner_id, product_id);
    return res.json({ success: true, data });
  } catch (e) {
    return fail(res, e.status || 500, e.code || "SERVER_ERROR", e.message);
  }
};

// edit a single lot (notes + qty + cp/sp optional)
export const updateLot = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { lot_id } = req.params;

    const data = await service.updateLot(owner_id, lot_id, req.body);
    return res.json({ success: true, data });
  } catch (e) {
    return fail(res, e.status || 500, e.code || "SERVER_ERROR", e.message);
  }
};

// bulk upsert: add new lots or increase qty for existing lots
export const bulkUpsertLots = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { product_id } = req.params;

    const data = await service.bulkUpsertLots(owner_id, product_id, req.body);
    return res.status(201).json({ success: true, data });
  } catch (e) {
    return fail(res, e.status || 500, e.code || "SERVER_ERROR", e.message);
  }
};
