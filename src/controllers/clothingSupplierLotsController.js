// src/controllers/clothingSupplierLotsController.js
const service = require("../services/clothingSupplierLotsService");

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

exports.listLots = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { supplier_id } = req.params;

    const { search, product_id, only_in_stock } = req.query;

    const data = await service.listLots(owner_id, supplier_id, {
      search,
      product_id,
      only_in_stock,
    });

    return res.json({ success: true, data });
  } catch (e) {
    return fail(res, e.status || 500, e.code || "SERVER_ERROR", e.message);
  }
};