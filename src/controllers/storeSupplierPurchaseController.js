import storeSupplierPurchaseService from "../services/storeSupplierPurchaseService.js";

const handleError = (res, error, context) => {
  if (["VALIDATION_ERROR", "INSUFFICIENT_QTY"].includes(error.code)) {
    return res.status(400).json({ success: false, error_code: error.code, message: error.message });
  }
  if (["SUPPLIER_NOT_FOUND", "PRODUCT_NOT_FOUND", "NOT_FOUND"].includes(error.code)) {
    return res.status(404).json({ success: false, error_code: error.code, message: error.message });
  }
  console.error(`Error ${context}:`, error);
  return res.status(500).json({ success: false, error_code: "SERVER_ERROR", message: `Failed to ${context}.` });
};

const storeSupplierPurchaseController = {
  async create(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const purchase = await storeSupplierPurchaseService.create(owner_id, req.body);
      return res.status(201).json({ success: true, data: purchase });
    } catch (error) {
      return handleError(res, error, "create purchase");
    }
  },

  async list(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const { supplier_id } = req.query;
      const purchases = await storeSupplierPurchaseService.list(owner_id, { supplier_id });
      return res.status(200).json({ success: true, data: purchases });
    } catch (error) {
      return handleError(res, error, "fetch purchases");
    }
  },

  async getById(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const purchase = await storeSupplierPurchaseService.getById(owner_id, req.params.id);
      return res.status(200).json({ success: true, data: purchase });
    } catch (error) {
      return handleError(res, error, "fetch purchase");
    }
  },

  async pay(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const purchase = await storeSupplierPurchaseService.pay(owner_id, req.params.id, req.body);
      return res.status(200).json({ success: true, data: purchase });
    } catch (error) {
      return handleError(res, error, "update payment");
    }
  },

  async getSupplierDue(req, res) {
    try {
      const owner_id = req.owner.owner_id;
      const due = await storeSupplierPurchaseService.getSupplierDue(owner_id, req.params.supplier_id);
      return res.status(200).json({ success: true, data: due });
    } catch (error) {
      return handleError(res, error, "fetch supplier due");
    }
  },
};

export default storeSupplierPurchaseController;