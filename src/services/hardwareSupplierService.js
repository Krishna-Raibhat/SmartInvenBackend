const HardwareSupplier = require("../models/HardwareSupplier");

class HardwareSupplierService {
  // CREATE
  async createSupplier(supplierData) {
    return await HardwareSupplier.create(supplierData);
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

    if(data.supplier_name!==undefined){
        supplier.supplier_name=data.supplier_name;
    }
    if(data.phone!==undefined){
        supplier.phone=data.phone;
    }
    if(data.email!==undefined){
        supplier.email=data.email;
    }
    if(data.address!==undefined){
        supplier.address=data.address;
    } 
    return await supplier.save();
  }

  // DELETE
  async deleteSupplier(id) {
    const supplier = await HardwareSupplier.findByPk(id);
    if (!supplier) return null;

    await supplier.destroy();
    return true;
  }
 


}

module.exports = new HardwareSupplierService();
