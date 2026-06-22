const express = require('express');
const {
  login,
  me,
  changePassword,
  getLoginEvents,
  twoFactorSetup,
  twoFactorEnable,
  twoFactorDisable,
} = require('../controllers/auth.controller');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.post('/login', login);
router.get('/me', protect, me);
// Self-service: any logged-in user can change their OWN password.
router.post('/change-password', protect, changePassword);
// Admin-only security log of recent login attempts (success + failures).
router.get('/login-events', protect, adminOnly, getLoginEvents);
// Optional two-factor (authenticator app), self-service per user.
router.post('/2fa/setup', protect, twoFactorSetup);
router.post('/2fa/enable', protect, twoFactorEnable);
router.post('/2fa/disable', protect, twoFactorDisable);

module.exports = router;
