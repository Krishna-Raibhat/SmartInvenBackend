// src/routes/storeSupplierReturnRoutes.js
import express from 'express';
const router = express.Router();
import * as controller from '../controllers/storeSupplierReturnController.js';
import auth from '../middlewares/authMiddleware.js';

// Create a new supplier return (immediate stock deduction)
router.post('/', auth, controller.create);

// Get all returns for authenticated owner
router.get('/', auth, controller.list);

// Get returns by supplier
router.get('/supplier/:supplier_id', auth, controller.getBySupplier);

// Get a single return by ID
router.get('/:return_id', auth, controller.getById);

export default router;
