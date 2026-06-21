const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  productValidation,
} = require('../controllers/productController');

// Public
router.get('/', getProducts);
router.get('/categories', getCategories);
router.get('/:id', getProduct);

// Vendeur
router.post('/', authenticate, requireRole('vendor'), upload.array('images', 5), productValidation, createProduct);
router.put('/:id', authenticate, requireRole('vendor', 'admin'), upload.array('images', 5), updateProduct);
router.delete('/:id', authenticate, requireRole('vendor', 'admin'), deleteProduct);

module.exports = router;