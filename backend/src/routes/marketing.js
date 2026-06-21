const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  getSitemap,
  getProductSeo,
  getReferralCode,
  useReferralCode,
  createPromoFlash,
  getActivePromos,
  getRobots,
} = require('../controllers/marketingController');

// Public
router.get('/sitemap', getSitemap);
router.get('/robots', getRobots);
router.get('/seo/product/:slug', getProductSeo);
router.get('/promos', getActivePromos);

// Vendeur
router.get('/referral', authenticate, requireRole('vendor'), getReferralCode);
router.post('/referral/use', authenticate, useReferralCode);
router.post('/promo', authenticate, requireRole('vendor'), createPromoFlash);

module.exports = router;