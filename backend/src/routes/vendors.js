const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getVendors,
  getVendor,
  getDashboard,
  updateProfile,
  getZones,
} = require('../controllers/vendorController');

// Public
router.get('/zones', getZones);
router.get('/me/dashboard', authenticate, getDashboard);
router.put('/me/profile', authenticate, updateProfile);
router.get('/', getVendors);
router.get('/:id', getVendor);

module.exports = router;