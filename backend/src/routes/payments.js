const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  initiatePayment,
  confirmPayment,
  releaseEscrow,
  refundPayment,
  getTransactionHistory,
  getWallet,
  subscribe,
  boostProduct,
  getPlans,
} = require('../controllers/paymentController');

router.post('/initiate', authenticate, initiatePayment);
router.post('/confirm', confirmPayment);
router.post('/release/:orderId', authenticate, releaseEscrow);
router.post('/refund/:orderId', authenticate, requireRole('admin'), refundPayment);
router.get('/history', authenticate, getTransactionHistory);
router.get('/wallet', authenticate, requireRole('vendor'), getWallet);
router.post('/subscribe', authenticate, requireRole('vendor'), subscribe);
router.post('/boost', authenticate, requireRole('vendor'), boostProduct);
router.get('/plans', getPlans);

module.exports = router;