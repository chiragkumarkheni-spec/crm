const express = require('express');
const { listActivity, heartbeat, presence } = require('../controllers/activity.controller');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.get('/', listActivity);
// Presence / idle-rep detection.
router.post('/heartbeat', heartbeat);
router.get('/presence', adminOnly, presence);

module.exports = router;
