const supplierService = require("../services/hardwareSupplierService.service");

// CREATE
exports.createSupplier = async (req, res) => {
  try {
    const supplier = await supplierService.createSupplier(req.body);
    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
