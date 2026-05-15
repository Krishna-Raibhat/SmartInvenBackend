import groceryUnitService from '../services/groceryUnitService.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

class GroceryUnitController {
  /**
   * Create a new grocery unit
   * POST /api/grocery/units
   */
  async createUnit(req, res) {
    try {
      const { unit_name } = req.body;
      const ownerId = req.user.owner_id;

      // Validation
      if (!unit_name || typeof unit_name !== 'string') {
        return errorResponse(res, 'Unit name is required', 400);
      }

      const trimmedName = unit_name.trim();

      if (trimmedName.length === 0) {
        return errorResponse(res, 'Unit name cannot be empty', 400);
      }

      if (trimmedName.length > 50) {
        return errorResponse(res, 'Unit name must be 50 characters or less', 400);
      }

      // Only allow alphanumeric and basic punctuation
      const validNamePattern = /^[a-zA-Z0-9\s\-\/\.]+$/;
      if (!validNamePattern.test(trimmedName)) {
        return errorResponse(
          res,
          'Unit name can only contain letters, numbers, spaces, hyphens, slashes, and dots',
          400
        );
      }

      const unit = await groceryUnitService.createUnit(ownerId, trimmedName);

      return successResponse(res, unit, 'Unit created successfully', 201);
    } catch (error) {
      if (error.message === 'Unit already exists') {
        return errorResponse(res, error.message, 409);
      }
      console.error('Error creating grocery unit:', error);
      return errorResponse(res, 'Failed to create unit', 500);
    }
  }

  /**
   * Get all units for the authenticated owner
   * GET /api/grocery/units
   */
  async getUnits(req, res) {
    try {
      const ownerId = req.user.owner_id;
      const units = await groceryUnitService.getUnitsByOwner(ownerId);

      return successResponse(res, units, 'Units retrieved successfully');
    } catch (error) {
      console.error('Error fetching grocery units:', error);
      return errorResponse(res, 'Failed to fetch units', 500);
    }
  }

  /**
   * Get a single unit by ID
   * GET /api/grocery/units/:id
   */
  async getUnitById(req, res) {
    try {
      const { id } = req.params;
      const ownerId = req.user.owner_id;

      const unit = await groceryUnitService.getUnitById(id, ownerId);

      return successResponse(res, unit, 'Unit retrieved successfully');
    } catch (error) {
      if (error.message === 'Unit not found') {
        return errorResponse(res, error.message, 404);
      }
      if (error.message === 'Unauthorized access to this unit') {
        return errorResponse(res, error.message, 403);
      }
      console.error('Error fetching grocery unit:', error);
      return errorResponse(res, 'Failed to fetch unit', 500);
    }
  }

  /**
   * Update a unit
   * PUT /api/grocery/units/:id
   */
  async updateUnit(req, res) {
    try {
      const { id } = req.params;
      const { unit_name } = req.body;
      const ownerId = req.user.owner_id;

      // Validation
      if (!unit_name || typeof unit_name !== 'string') {
        return errorResponse(res, 'Unit name is required', 400);
      }

      const trimmedName = unit_name.trim();

      if (trimmedName.length === 0) {
        return errorResponse(res, 'Unit name cannot be empty', 400);
      }

      if (trimmedName.length > 50) {
        return errorResponse(res, 'Unit name must be 50 characters or less', 400);
      }

      // Only allow alphanumeric and basic punctuation
      const validNamePattern = /^[a-zA-Z0-9\s\-\/\.]+$/;
      if (!validNamePattern.test(trimmedName)) {
        return errorResponse(
          res,
          'Unit name can only contain letters, numbers, spaces, hyphens, slashes, and dots',
          400
        );
      }

      const unit = await groceryUnitService.updateUnit(id, ownerId, trimmedName);

      return successResponse(res, unit, 'Unit updated successfully');
    } catch (error) {
      if (error.message === 'Unit not found') {
        return errorResponse(res, error.message, 404);
      }
      if (error.message === 'Unauthorized access to this unit') {
        return errorResponse(res, error.message, 403);
      }
      if (error.message === 'Unit name already exists') {
        return errorResponse(res, error.message, 409);
      }
      console.error('Error updating grocery unit:', error);
      return errorResponse(res, 'Failed to update unit', 500);
    }
  }

  /**
   * Delete a unit
   * DELETE /api/grocery/units/:id
   */
  async deleteUnit(req, res) {
    try {
      const { id } = req.params;
      const ownerId = req.user.owner_id;

      const result = await groceryUnitService.deleteUnit(id, ownerId);

      return successResponse(res, result, result.message);
    } catch (error) {
      if (error.message === 'Unit not found') {
        return errorResponse(res, error.message, 404);
      }
      if (error.message === 'Unauthorized access to this unit') {
        return errorResponse(res, error.message, 403);
      }
      if (error.message.includes('Cannot delete unit')) {
        return errorResponse(res, error.message, 409);
      }
      console.error('Error deleting grocery unit:', error);
      return errorResponse(res, 'Failed to delete unit', 500);
    }
  }
}

export default new GroceryUnitController();
