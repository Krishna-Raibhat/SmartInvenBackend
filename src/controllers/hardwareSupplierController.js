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

// READ ALL
exports.getSuppliers = async (req, res) => {
  try {
    const { owner_id } = req.query;
    const suppliers = await supplierService.getAllSuppliers(owner_id);
    res.status(200).json({ success: true, data: suppliers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//READ BY ID
exports.getSupplierById = async (req, res) => {
  try {
    const supplier = await supplierService.getSupplierById(req.params.id);
    if (!supplier) {
      return res
        .status(404)
        .json({ success: false, message: "Supplier not found" });
    }
    res.status(200).json({ success: true, data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
