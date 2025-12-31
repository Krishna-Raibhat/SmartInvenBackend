// src/controllers/clothingStockLotController.js
const service = require("../services/clothingStockLotService");

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

exports.bulkCreate = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;

    const { product_id, supplier_id, cp, sp, notes, variants } = req.body;

    if (!product_id || !supplier_id) {
      return fail(
        res,
        400,
        "VALIDATION_REQUIRED_FIELDS",
        "product_id and supplier_id are required"
      );
    }

    const data = await service.bulkCreate(owner_id, {
      product_id,
      supplier_id,
      cp,
      sp,
      notes,
      variants,
    });

    return res.status(201).json({ success: true, data, count: data.lots.length });
  } catch (err) {
    if (err.status) return fail(res, err.status, err.code || "ERROR", err.message);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};
