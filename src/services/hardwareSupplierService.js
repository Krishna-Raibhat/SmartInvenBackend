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

  // UPDATE
  async updateSupplier(id, data) {
    const supplier = await HardwareSupplier.findByPk(id);
    if(!supplier) return null;
    return await supplier.update(data);
  }

  /* DELETE
  async deleteSupplier(id) {
    const supplier = await HardwareSupplier.findByPk(id);
    if (!supplier) return null;

    await supplier.destroy();
    return true;
  }
 */


}

module.exports = new HardwareSupplierService();
