const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  getDashboard,
  getProductsPending,
  updateProductStatus,
  getUsers,
  updateUserStatus,
  getDisputes,
  resolveDispute,
  getCommissions,
  getAdminLogs,
} = require('../controllers/adminController');

// Toutes les routes protégées admin
router.use(authenticate, requireRole('admin'));

router.get('/dashboard', getDashboard);
router.get('/products/pending', getProductsPending);
router.patch('/products/:id/status', updateProductStatus);
router.get('/users', getUsers);
router.patch('/users/:id/status', updateUserStatus);
router.get('/disputes', getDisputes);
router.patch('/disputes/:id/resolve', resolveDispute);
router.get('/commissions', getCommissions);
router.get('/logs', getAdminLogs);

module.exports = router;