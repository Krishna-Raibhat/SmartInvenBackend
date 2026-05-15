import express from 'express';
const router = express.Router();
import groceryUnitController from '../controllers/groceryUnitController.js';
import auth from '../middleware/auth.js';

// Create a new unit
router.post('/', auth, groceryUnitController.createUnit);

// Get all units for authenticated owner
router.get('/', auth, groceryUnitController.getUnits);

// Get a single unit by ID
router.get('/:id', auth, groceryUnitController.getUnitById);

// Update a unit
router.put('/:id', auth, groceryUnitController.updateUnit);

// Delete a unit
router.delete('/:id', auth, groceryUnitController.deleteUnit);

export default router;
