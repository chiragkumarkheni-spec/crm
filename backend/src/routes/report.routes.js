const express = require('express');
const { summary, byEmployee } = require('../controllers/report.controller');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.get('/summary', summary);
router.get('/by-employee', adminOnly, byEmployee);

module.exports = router;
