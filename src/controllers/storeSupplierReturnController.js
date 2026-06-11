// src/controllers/storeSupplierReturnController.js
import service from '../services/storeSupplierReturnService.js';

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

export const create = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { supplier_id, note, items } = req.body;

    const result = await service.createReturn(owner_id, {
      supplier_id,
      note,
      items,
    });

    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    if (err.status) {
      return fail(res, err.status, err.code || 'ERROR', err.message);
    }
    console.error('Error creating store supplier return:', err);
    return fail(res, 500, 'SERVER_ERROR', err.message);
  }
};

export const list = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const data = await service.list(owner_id);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('Error listing store supplier returns:', err);
    return fail(res, 500, 'SERVER_ERROR', err.message);
  }
};

export const getById = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { return_id } = req.params;

    const data = await service.getById(owner_id, return_id);

    if (!data) {
      return fail(res, 404, 'NOT_FOUND', 'Return not found');
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching store supplier return:', err);
    return fail(res, 500, 'SERVER_ERROR', err.message);
  }
};

export const getBySupplier = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { supplier_id } = req.params;

    const data = await service.getBySupplier(owner_id, supplier_id);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching returns by supplier:', err);
    return fail(res, 500, 'SERVER_ERROR', err.message);
  }
};
