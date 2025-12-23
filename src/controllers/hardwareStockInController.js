const stockInService = require("../services/hardwareStockInService");

exports.stockIn = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;

    const { product_id, supplier_id, cp, sp, qty, notes } = req.body;

    if (!product_id || !supplier_id || cp === undefined || sp === undefined || qty === undefined) {
      return res.status(400).json({
        success: false,
        error_code: "VALIDATION_REQUIRED_FIELDS",
        message: "product_id, supplier_id, cp, sp, qty are required",
      });
    }

    const lot = await stockInService.stockIn({
      owner_id,
      product_id,
      supplier_id,
      cp,
      sp,
      qty,
      notes
      
    });

    if (!lot) {
      return res.status(404).json({
        success: false,
        error_code: "PRODUCT_NOT_FOUND",
        message: "Product not found for this owner",
      });
    }

    return res.status(201).json({ success: true, data: lot });
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      error_code: err.code || "SERVER_ERROR",
      message: err.message,
    });
  }
};
