const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  getActiveCampaign,
  getAllCampaigns,
  createCampaign,
  toggleCampaign,
  deleteCampaign,
} = require('../controllers/campaignController');

// Public
router.get('/active', getActiveCampaign);

// Admin
router.get('/', authenticate, requireRole('admin'), getAllCampaigns);
router.post('/', authenticate, requireRole('admin'), upload.single('banner_image'), createCampaign);
router.patch('/:id', authenticate, requireRole('admin'), toggleCampaign);
router.delete('/:id', authenticate, requireRole('admin'), deleteCampaign);

module.exports = router;