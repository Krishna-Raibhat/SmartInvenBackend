const HardwareSupplier = require("../models/HardwareSupplier");

class HardwareSupplierService {

    // CREATE
    async createSupplier(data){
        return await HardwareSupplier.create(data);
    }

    
}