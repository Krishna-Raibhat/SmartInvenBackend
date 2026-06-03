import service from '../services/groceryProductService.js';

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

export const create = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    let {
      category_id,
      brand_id,
      unit_id,
      product_name,
      barcode,
      description,
    } = req.body;

    // Required fields validation
    unit_id = String(unit_id || '').trim();
    product_name = String(product_name || '').trim();

    if (!unit_id || !product_name) {
      return fail(
        res,
        400,
        'VALIDATION_REQUIRED_FIELDS',
        'unit_id and product_name are required'
      );
    }

    // Product name validation
    if (product_name.length < 3) {
      return fail(
        res,
        400,
        'VALIDATION_PRODUCT_NAME_TOO_SHORT',
        'Product name must be at least 3 characters'
      );
    }

    if (product_name.length > 200) {
      return fail(
        res,
        400,
        'VALIDATION_PRODUCT_NAME_TOO_LONG',
        'Product name must be 200 characters or less'
      );
    }

    // Optional fields trimming
    if (category_id) category_id = String(category_id).trim();
    if (brand_id) brand_id = String(brand_id).trim();
    if (barcode) {
      barcode = String(barcode).trim();
      if (barcode.length > 50) {
        return fail(
          res,
          400,
          'VALIDATION_BARCODE_TOO_LONG',
          'Barcode must be 50 characters or less'
        );
      }
    }
    if (description) {
      description = String(description).trim();
      if (description.length > 500) {
        return fail(
          res,
          400,
          'VALIDATION_DESCRIPTION_TOO_LONG',
          'Description must be 500 characters or less'
        );
      }
    }

    const created = await service.create({
      owner_id,
      category_id,
      brand_id,
      unit_id,
      product_name,
      barcode,
      description,
    });

    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    if (err.status) return fail(res, err.status, err.code || 'ERROR', err.message);
    console.error('Error creating grocery product:', err);
    return fail(res, 500, 'SERVER_ERROR', err.message);
  }
};

export const list = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const data = await service.list(owner_id);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('Error listing grocery products:', err);
    return fail(res, 500, 'SERVER_ERROR', err.message);
  }
};

export const getById = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { product_id } = req.params;

    const data = await service.getById(owner_id, product_id);
    if (!data) return fail(res, 404, 'NOT_FOUND', 'Product not found');

    return res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching grocery product:', err);
    return fail(res, 500, 'SERVER_ERROR', err.message);
  }
};

export const getByBarcode = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { barcode } = req.params;

    if (!barcode || !barcode.trim()) {
      return fail(res, 400, 'VALIDATION_BARCODE_REQUIRED', 'Barcode is required');
    }

    const data = await service.getByBarcode(owner_id, barcode.trim());
    return res.json({ success: true, data });
  } catch (err) {
    if (err.status) return fail(res, err.status, err.code || 'ERROR', err.message);
    console.error('Error fetching product by barcode:', err);
    return fail(res, 500, 'SERVER_ERROR', err.message);
  }
};

export const update = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { product_id } = req.params;

    let {
      category_id,
      brand_id,
      unit_id,
      product_name,
      barcode,
      description,
    } = req.body;

    // Trim and validate if provided
    if (unit_id !== undefined) unit_id = String(unit_id || '').trim();
    if (product_name !== undefined) {
      product_name = String(product_name || '').trim();
      if (product_name.length < 3) {
        return fail(
          res,
          400,
          'VALIDATION_PRODUCT_NAME_TOO_SHORT',
          'Product name must be at least 3 characters'
        );
      }
      if (product_name.length > 200) {
        return fail(
          res,
          400,
          'VALIDATION_PRODUCT_NAME_TOO_LONG',
          'Product name must be 200 characters or less'
        );
      }
    }
    if (category_id !== undefined) category_id = String(category_id || '').trim() || null;
    if (brand_id !== undefined) brand_id = String(brand_id || '').trim() || null;
    if (barcode !== undefined) {
      barcode = String(barcode || '').trim() || null;
      if (barcode && barcode.length > 50) {
        return fail(
          res,
          400,
          'VALIDATION_BARCODE_TOO_LONG',
          'Barcode must be 50 characters or less'
        );
      }
    }
    if (description !== undefined) {
      description = String(description || '').trim() || null;
      if (description && description.length > 500) {
        return fail(
          res,
          400,
          'VALIDATION_DESCRIPTION_TOO_LONG',
          'Description must be 500 characters or less'
        );
      }
    }

    // Check if at least one field is provided
    if (
      category_id === undefined &&
      brand_id === undefined &&
      unit_id === undefined &&
      product_name === undefined &&
      barcode === undefined &&
      description === undefined
    ) {
      return fail(
        res,
        400,
        'VALIDATION_REQUIRED_FIELDS',
        'At least one field is required to update'
      );
    }

    const updated = await service.update(owner_id, product_id, {
      category_id,
      brand_id,
      unit_id,
      product_name,
      barcode,
      description,
    });

    if (!updated) return fail(res, 404, 'NOT_FOUND', 'Product not found');

    return res.json({ success: true, data: updated });
  } catch (err) {
    if (err.status) return fail(res, err.status, err.code || 'ERROR', err.message);
    console.error('Error updating grocery product:', err);
    return fail(res, 500, 'SERVER_ERROR', err.message);
  }
};

export const remove = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { product_id } = req.params;

    const deleted = await service.remove(owner_id, product_id);

    if (deleted === null) return fail(res, 404, 'NOT_FOUND', 'Product not found');
    if (deleted === false) {
      return fail(
        res,
        409,
        'DELETE_BLOCKED',
        'Cannot delete product because it has stock lots'
      );
    }

    return res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting grocery product:', err);
    return fail(res, 500, 'SERVER_ERROR', err.message);
  }
};

export const getAverageCost = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const result = await service.getAverageCost(owner_id);
    
    if (!result) return fail(res, 404, 'NOT_FOUND', 'No products found');
    
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('Error getting average cost:', err);
    return fail(res, 500, 'SERVER_ERROR', err.message);
  }
};
