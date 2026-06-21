const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { submitKyc, getKycStatus, reviewKyc, getPendingKyc } = require('../controllers/kycController');

// Vendeur
router.post('/submit', authenticate, requireRole('vendor'), upload.array('documents', 3), submitKyc);
router.get('/status', authenticate, requireRole('vendor'), getKycStatus);

// Admin
router.get('/pending', authenticate, requireRole('admin'), getPendingKyc);
router.put('/:vendorId/review', authenticate, requireRole('admin'), reviewKyc);

module.exports = router;