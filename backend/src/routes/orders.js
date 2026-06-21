const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
} = require('../controllers/orderController');

router.post('/', authenticate, createOrder);
router.get('/', authenticate, getOrders);
router.get('/:id', authenticate, getOrder);
router.put('/:id/status', authenticate, updateOrderStatus);
router.post('/:id/cancel', authenticate, cancelOrder);

module.exports = router;