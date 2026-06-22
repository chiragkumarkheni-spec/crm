const express = require('express');
const {
  login,
  me,
  changePassword,
  getLoginEvents,
} = require('../controllers/auth.controller');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.post('/login', login);
router.get('/me', protect, me);
// Self-service: any logged-in user can change their OWN password.
router.post('/change-password', protect, changePassword);
// Admin-only security log of recent login attempts (success + failures).
router.get('/login-events', protect, adminOnly, getLoginEvents);

module.exports = router;
