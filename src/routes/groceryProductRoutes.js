import express from 'express';
const router = express.Router();
import * as controller from '../controllers/groceryProductController.js';
import auth from '../middleware/auth.js';

// Create a new product
router.post('/', auth, controller.create);

// Get all products for authenticated owner
router.get('/', auth, controller.list);

// Get product by barcode
router.get('/barcode/:barcode', auth, controller.getByBarcode);

// Get a single product by ID
router.get('/:product_id', auth, controller.getById);

// Update a product
router.put('/:product_id', auth, controller.update);

// Delete a product
router.delete('/:product_id', auth, controller.remove);

export default router;
