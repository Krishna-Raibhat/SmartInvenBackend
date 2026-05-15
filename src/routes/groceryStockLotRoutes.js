import express from 'express';
const router = express.Router();
import * as controller from '../controllers/groceryStockLotController.js';
import auth from '../middlewares/authMiddleware.js';

// Create a new stock lot
router.post('/', auth, controller.create);

// Get all stock lots for authenticated owner
router.get('/', auth, controller.getAll);

// Get low stock products
router.get('/low-stock', auth, controller.getLowStock);

// Get stock lots by product
router.get('/product/:product_id', auth, controller.getByProduct);

// Get a single stock lot by ID
router.get('/:lot_id', auth, controller.getById);

// Update a stock lot
router.put('/:lot_id', auth, controller.update);

// Delete a stock lot
router.delete('/:lot_id', auth, controller.remove);

export default router;
