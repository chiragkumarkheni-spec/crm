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
const { validate, z } = require('../middleware/validate');

const router = express.Router();

const loginSchema = z
  .object({
    email: z.string().email('Sahi email daalo'),
    password: z.string().min(1, 'Password daalo'),
    code: z.string().optional(),
    deviceId: z.string().optional(),
  })
  .passthrough();

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password daalo'),
    newPassword: z.string().min(1, 'Naya password daalo'),
  })
  .passthrough();

router.post('/login', validate(loginSchema), login);
router.get('/me', protect, me);
// Self-service: any logged-in user can change their OWN password.
router.post('/change-password', protect, validate(changePasswordSchema), changePassword);
// Admin-only security log of recent login attempts (success + failures).
router.get('/login-events', protect, adminOnly, getLoginEvents);
// Optional two-factor (authenticator app), self-service per user.
router.post('/2fa/setup', protect, twoFactorSetup);
router.post('/2fa/enable', protect, twoFactorEnable);
router.post('/2fa/disable', protect, twoFactorDisable);

module.exports = router;
