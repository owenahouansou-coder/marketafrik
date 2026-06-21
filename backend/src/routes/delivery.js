const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  setDeliveryZone,
  getDeliveryZones,
  getDeliveryFee,
  startDelivery,
  updateDeliveryStatus,
  uploadProof,
  confirmReception,
  getDelivery,
} = require('../controllers/deliveryController');

// Public
router.get('/zones/:vendorId', getDeliveryZones);
router.get('/fee', getDeliveryFee);

// Vendeur
router.post('/zones', authenticate, requireRole('vendor'), setDeliveryZone);
router.post('/start/:orderId', authenticate, requireRole('vendor'), startDelivery);
router.put('/status/:orderId', authenticate, requireRole('vendor'), updateDeliveryStatus);
router.post('/proof/:orderId', authenticate, requireRole('vendor'), upload.single('photo'), uploadProof);

// Acheteur
router.post('/confirm/:orderId', authenticate, confirmReception);

// Les deux
router.get('/:orderId', authenticate, getDelivery);

module.exports = router;