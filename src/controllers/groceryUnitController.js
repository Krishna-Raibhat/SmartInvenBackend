import groceryUnitService from '../services/groceryUnitService.js';

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

class GroceryUnitController {
  async createUnit(req, res) {
    try {
      const { unit_name } = req.body;
      const ownerId = req.user.owner_id;

      if (!unit_name || typeof unit_name !== 'string') {
        return fail(res, 400, 'VALIDATION_ERROR', 'Unit name is required');
      }

      const trimmedName = unit_name.trim();

      if (trimmedName.length === 0) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Unit name cannot be empty');
      }

      if (trimmedName.length > 50) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Unit name must be 50 characters or less');
      }

      const validNamePattern = /^[a-zA-Z0-9\s\-\/\.]+$/;
      if (!validNamePattern.test(trimmedName)) {
        return fail(
          res,
          400,
          'VALIDATION_ERROR',
          'Unit name can only contain letters, numbers, spaces, hyphens, slashes, and dots'
        );
      }

      const unit = await groceryUnitService.createUnit(ownerId, trimmedName);
      return res.status(201).json({ success: true, data: unit });
    } catch (error) {
      if (error.message === 'Unit already exists') {
        return fail(res, 409, 'UNIT_EXISTS', error.message);
      }
      console.error('Error creating grocery unit:', error);
      return fail(res, 500, 'SERVER_ERROR', 'Failed to create unit');
    }
  }

  async getUnits(req, res) {
    try {
      const ownerId = req.user.owner_id;
      const units = await groceryUnitService.getUnitsByOwner(ownerId);
      return res.json({ success: true, data: units });
    } catch (error) {
      console.error('Error fetching grocery units:', error);
      return fail(res, 500, 'SERVER_ERROR', 'Failed to fetch units');
    }
  }

  async getUnitById(req, res) {
    try {
      const { id } = req.params;
      const ownerId = req.user.owner_id;
      const unit = await groceryUnitService.getUnitById(id, ownerId);
      return res.json({ success: true, data: unit });
    } catch (error) {
      if (error.message === 'Unit not found') {
        return fail(res, 404, 'NOT_FOUND', error.message);
      }
      if (error.message === 'Unauthorized access to this unit') {
        return fail(res, 403, 'UNAUTHORIZED', error.message);
      }
      console.error('Error fetching grocery unit:', error);
      return fail(res, 500, 'SERVER_ERROR', 'Failed to fetch unit');
    }
  }

  async updateUnit(req, res) {
    try {
      const { id } = req.params;
      const { unit_name } = req.body;
      const ownerId = req.user.owner_id;

      if (!unit_name || typeof unit_name !== 'string') {
        return fail(res, 400, 'VALIDATION_ERROR', 'Unit name is required');
      }

      const trimmedName = unit_name.trim();

      if (trimmedName.length === 0) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Unit name cannot be empty');
      }

      if (trimmedName.length > 50) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Unit name must be 50 characters or less');
      }

      const validNamePattern = /^[a-zA-Z0-9\s\-\/\.]+$/;
      if (!validNamePattern.test(trimmedName)) {
        return fail(
          res,
          400,
          'VALIDATION_ERROR',
          'Unit name can only contain letters, numbers, spaces, hyphens, slashes, and dots'
        );
      }

      const unit = await groceryUnitService.updateUnit(id, ownerId, trimmedName);
      return res.json({ success: true, data: unit });
    } catch (error) {
      if (error.message === 'Unit not found') {
        return fail(res, 404, 'NOT_FOUND', error.message);
      }
      if (error.message === 'Unauthorized access to this unit') {
        return fail(res, 403, 'UNAUTHORIZED', error.message);
      }
      if (error.message === 'Unit name already exists') {
        return fail(res, 409, 'UNIT_EXISTS', error.message);
      }
      console.error('Error updating grocery unit:', error);
      return fail(res, 500, 'SERVER_ERROR', 'Failed to update unit');
    }
  }

  async deleteUnit(req, res) {
    try {
      const { id } = req.params;
      const ownerId = req.user.owner_id;
      const result = await groceryUnitService.deleteUnit(id, ownerId);
      return res.json({ success: true, message: result.message });
    } catch (error) {
      if (error.message === 'Unit not found') {
        return fail(res, 404, 'NOT_FOUND', error.message);
      }
      if (error.message === 'Unauthorized access to this unit') {
        return fail(res, 403, 'UNAUTHORIZED', error.message);
      }
      if (error.message.includes('Cannot delete unit')) {
        return fail(res, 409, 'DELETE_BLOCKED', error.message);
      }
      console.error('Error deleting grocery unit:', error);
      return fail(res, 500, 'SERVER_ERROR', 'Failed to delete unit');
    }
  }
}

export default new GroceryUnitController();
