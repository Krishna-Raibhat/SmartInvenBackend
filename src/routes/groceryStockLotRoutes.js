import express from 'express';
const router = express.Router();
import * as controller from '../controllers/groceryStockLotController.js';
import auth from '../middlewares/authMiddleware.js';

// Create a new stock lot
router.post('/', auth, controller.create);

// Get all stock lots for authenticated owner
router.get('/', auth, controller.getAll);

// Get lot by barcode scan
router.get('/scan/:barcode', auth, controller.getByBarcode);

// Get stock lots by product
router.get('/product/:product_id', auth, controller.getByProduct);

// Preview barcode image
router.get('/:lot_id/barcode-image', auth, controller.getBarcodeImage);

// Get a single stock lot by ID
router.get('/:lot_id', auth, controller.getById);

// Update a stock lot
router.put('/:lot_id', auth, controller.update);

// Delete a stock lot
router.delete('/:lot_id', auth, controller.remove);

export default router;
