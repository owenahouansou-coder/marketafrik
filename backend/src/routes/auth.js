const express = require('express');
const router = express.Router();
const {
  register,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  refresh,
  logout,
  me,
  registerValidation,
  loginValidation,
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticate, me);

module.exports = router;