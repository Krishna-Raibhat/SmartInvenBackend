const HardwareSupplier = require("../models/HardwareSupplier");

class HardwareSupplierService {
  // CREATE
  async createSupplier(data) {
    return await HardwareSupplier.create(data);
  }

  // READ ALL (optional owner filter)
  async getAllSuppliers(owner_id) {
    const condition = owner_id ? { where: { owner_id } } : {};
    return await HardwareSupplier.findAll(condition);
  }

  // READ BY ID
  async getSupplierById(id) {
    return await HardwareSupplier.findByPk(id);
  }
}

module.exports = new HardwareSupplierService();
