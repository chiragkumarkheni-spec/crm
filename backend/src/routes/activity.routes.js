const express = require('express');
const { listActivity } = require('../controllers/activity.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.get('/', listActivity);

module.exports = router;
