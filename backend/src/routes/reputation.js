const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  createReview,
  getVendorReviews,
  openDispute,
  respondToDispute,
  resolveDispute,
  createReport,
  getReputation,
} = require('../controllers/reputationController');

// Avis
router.post('/reviews', authenticate, createReview);
router.get('/reviews/:vendorId', getVendorReviews);

// Litiges
router.post('/disputes', authenticate, openDispute);
router.put('/disputes/:id/respond', authenticate, requireRole('vendor'), respondToDispute);
router.put('/disputes/:id/resolve', authenticate, requireRole('admin'), resolveDispute);

// Signalements
router.post('/reports', authenticate, createReport);

// Score réputation
router.get('/:vendorId', getReputation);

module.exports = router;