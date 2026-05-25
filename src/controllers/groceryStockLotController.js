import service from '../services/groceryStockLotService.js';
import prisma from '../config/prisma.js';
import { getObject } from '../utils/s3.js';

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

export const create = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    let { product_id, supplier_id, qty_in, cp, sp, batch_no, expiry_date, notes } = req.body;

    // Required fields validation
    product_id = String(product_id || '').trim();
    supplier_id = String(supplier_id || '').trim();

    if (!product_id || !supplier_id) {
      return fail(
        res,
        400,
        'VALIDATION_REQUIRED_FIELDS',
        'product_id and supplier_id are required'
      );
    }

    // Quantity validation
    if (qty_in === undefined || qty_in === null) {
      return fail(res, 400, 'VALIDATION_QTY_REQUIRED', 'qty_in is required');
    }

    const qtyNum = Number(qty_in);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      return fail(
        res,
        400,
        'VALIDATION_QTY_INVALID',
        'qty_in must be a positive number'
      );
    }

    // Price validation
    if (cp === undefined || cp === null) {
      return fail(res, 400, 'VALIDATION_CP_REQUIRED', 'cp (cost price) is required');
    }

    if (sp === undefined || sp === null) {
      return fail(res, 400, 'VALIDATION_SP_REQUIRED', 'sp (selling price) is required');
    }

    const cpNum = Number(cp);
    const spNum = Number(sp);

    if (!Number.isFinite(cpNum) || cpNum < 0) {
      return fail(
        res,
        400,
        'VALIDATION_CP_INVALID',
        'cp must be a non-negative number'
      );
    }

    if (!Number.isFinite(spNum) || spNum < 0) {
      return fail(
        res,
        400,
        'VALIDATION_SP_INVALID',
        'sp must be a non-negative number'
      );
    }

    // Optional fields
    if (batch_no) {
      batch_no = String(batch_no).trim();
      if (batch_no.length > 100) {
        return fail(
          res,
          400,
          'VALIDATION_BATCH_TOO_LONG',
          'batch_no must be 100 characters or less'
        );
      }
    }

    if (expiry_date) {
      const expiryDateObj = new Date(expiry_date);
      if (isNaN(expiryDateObj.getTime())) {
        return fail(
          res,
          400,
          'VALIDATION_EXPIRY_INVALID',
          'expiry_date must be a valid date'
        );
      }
    }

    if (notes) {
      notes = String(notes).trim();
      if (notes.length > 500) {
        return fail(
          res,
          400,
          'VALIDATION_NOTES_TOO_LONG',
          'notes must be 500 characters or less'
        );
      }
    }

    const result = await service.create({
      owner_id,
      product_id,
      supplier_id,
      qty_in: qtyNum,
      cp: cpNum,
      sp: spNum,
      batch_no,
      expiry_date,
      notes,
    });

    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    if (err.status) return fail(res, err.status, err.code || 'ERROR', err.message);
    console.error('Error creating grocery stock lot:', err);
    return fail(res, 500, 'SERVER_ERROR', err.message);
  }
};

export const getAll = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const data = await service.getAll(owner_id);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('Error listing grocery stock lots:', err);
    return fail(res, 500, 'SERVER_ERROR', err.message);
  }
};

export const getByProduct = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { product_id } = req.params;

    const data = await service.getByProduct(owner_id, product_id);
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) return fail(res, err.status, err.code || 'ERROR', err.message);
    console.error('Error fetching stock lots by product:', err);
    return fail(res, 500, 'SERVER_ERROR', err.message);
  }
};

export const getById = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { lot_id } = req.params;

    const data = await service.getById(owner_id, lot_id);
    if (!data) return fail(res, 404, 'NOT_FOUND', 'Stock lot not found');

    return res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching grocery stock lot:', err);
    return fail(res, 500, 'SERVER_ERROR', err.message);
  }
};

export const update = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { lot_id } = req.params;
    let { cp, sp, batch_no, expiry_date, notes, qty_remaining, qty_in } = req.body;

    // Validate if at least one field is provided
    if (
      cp === undefined &&
      sp === undefined &&
      batch_no === undefined &&
      expiry_date === undefined &&
      notes === undefined &&
      qty_remaining === undefined &&
      qty_in === undefined
    ) {
      return fail(
        res,
        400,
        'VALIDATION_REQUIRED_FIELDS',
        'At least one field is required to update'
      );
    }

    // Price validation
    if (cp !== undefined) {
      const cpNum = Number(cp);
      if (!Number.isFinite(cpNum) || cpNum < 0) {
        return fail(
          res,
          400,
          'VALIDATION_CP_INVALID',
          'cp must be a non-negative number'
        );
      }
      cp = cpNum;
    }

    if (sp !== undefined) {
      const spNum = Number(sp);
      if (!Number.isFinite(spNum) || spNum < 0) {
        return fail(
          res,
          400,
          'VALIDATION_SP_INVALID',
          'sp must be a non-negative number'
        );
      }
      sp = spNum;
    }

    // Optional fields
    if (batch_no !== undefined) {
      batch_no = String(batch_no || '').trim() || null;
      if (batch_no && batch_no.length > 100) {
        return fail(
          res,
          400,
          'VALIDATION_BATCH_TOO_LONG',
          'batch_no must be 100 characters or less'
        );
      }
    }

    if (expiry_date !== undefined) {
      if (expiry_date) {
        const expiryDateObj = new Date(expiry_date);
        if (isNaN(expiryDateObj.getTime())) {
          return fail(
            res,
            400,
            'VALIDATION_EXPIRY_INVALID',
            'expiry_date must be a valid date'
          );
        }
      } else {
        expiry_date = null;
      }
    }

    if (notes !== undefined) {
      notes = String(notes || '').trim() || null;
      if (notes && notes.length > 500) {
        return fail(
          res,
          400,
          'VALIDATION_NOTES_TOO_LONG',
          'notes must be 500 characters or less'
        );
      }
    }

    // Quantity validation
    if (qty_remaining !== undefined) {
      const qtyNum = Number(qty_remaining);
      if (!Number.isFinite(qtyNum) || qtyNum < 0) {
        return fail(
          res,
          400,
          'VALIDATION_QTY_INVALID',
          'qty_remaining must be a non-negative number'
        );
      }
      qty_remaining = qtyNum;
    }

    // Initial quantity validation
    if (qty_in !== undefined) {
      const qtyNum = Number(qty_in);
      if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
        return fail(
          res,
          400,
          'VALIDATION_QTY_IN_INVALID',
          'qty_in must be a positive number'
        );
      }
      qty_in = qtyNum;
    }

    const updated = await service.update(owner_id, lot_id, {
      cp,
      sp,
      batch_no,
      expiry_date,
      notes,
      qty_remaining,
      qty_in,
    });

    if (!updated) return fail(res, 404, 'NOT_FOUND', 'Stock lot not found');

    return res.json({ success: true, data: updated });
  } catch (err) {
    if (err.status) return fail(res, err.status, err.code || 'ERROR', err.message);
    console.error('Error updating grocery stock lot:', err);
    return fail(res, 500, 'SERVER_ERROR', err.message);
  }
};

export const remove = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { lot_id } = req.params;

    const deleted = await service.remove(owner_id, lot_id);

    if (deleted === null) return fail(res, 404, 'NOT_FOUND', 'Stock lot not found');
    if (deleted === false) {
      return fail(
        res,
        409,
        'DELETE_BLOCKED',
        'Cannot delete stock lot because some quantity has been sold'
      );
    }

    return res.json({ success: true, message: 'Stock lot deleted successfully' });
  } catch (err) {
    console.error('Error deleting grocery stock lot:', err);
    return fail(res, 500, 'SERVER_ERROR', err.message);
  }
};

// Get stock lot by barcode (for barcode scanning)
export const getByBarcode = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { barcode } = req.params;
    const data = await service.getByBarcode(owner_id, barcode);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    if (err.status) return fail(res, err.status, err.code || 'ERROR', err.message);
    return fail(res, 500, 'SERVER_ERROR', err.message);
  }
};

// Get barcode image (stream from S3)
export const getBarcodeImage = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { lot_id } = req.params;

    const lot = await prisma.groceryStockLot.findFirst({
      where: { lot_id, owner_id },
      select: { barcode_image_url: true },
    });

    if (!lot || !lot.barcode_image_url) {
      return fail(res, 404, 'NOT_FOUND', 'Barcode image not found');
    }

    const stream = await getObject(lot.barcode_image_url);

    res.setHeader('Content-Type', 'image/png');
    stream.pipe(res);
  } catch (err) {
    return fail(res, 500, 'SERVER_ERROR', err.message);
  }
};
