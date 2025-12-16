const supplierService = require("../services/hardwareSupplierService");

// CREATE
exports.createSupplier = async (req, res) => {
  try {
    const {
      supplier_name,
      phone,
      email,
      address
    } = req.body;

    // Get owner_id from auth middleware
    const owner_id = req.owner.owner_id; 

    // Create clean data object
    const supplierData = {
      supplier_name,
      phone,
      email,
      address,
      owner_id
    };

    const supplier = await supplierService.createSupplier(supplierData);
    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// READ ALL
exports.getSuppliers = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const suppliers = await supplierService.getAllSuppliers(owner_id);
    res.status(200).json({ success: true, data: suppliers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//READ BY ID
exports.getSupplierById = async (req, res) => {
  try {
    const supplier = await supplierService.getSupplierById(req.params.supplier_id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: "Supplier not found" });
    }
    res.status(200).json({ success: true, data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// UPDATE
exports.updateSupplier = async (req, res) => {
  try {
    const {supplierId,supplierName, phone, email, address} = req.body;

    if(!supplierId){
      return res.status(400).json({ success: false, message: "supplierId is required" });
    } 
    if(!supplierName && !phone && !email && !address){
      return res.status(400).json({ success: false, message: "At least one field to update must be provided" });
    }
    const supplierData = {supplierName, phone, email, address};

    const supplier = await supplierService.updateSupplier(supplierId,supplierData);

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

// DELETE
exports.deleteSupplier = async (req, res) => {
  try {
    const supplierId = req.params.supplier_id;
    const deleted = await supplierService.deleteSupplier(supplierId);

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Supplier not found" });
    }

    res.status(200).json({
      success: true,
      message: "Supplier deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

