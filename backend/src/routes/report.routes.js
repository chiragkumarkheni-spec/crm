const express = require('express');
const {
  summary,
  byEmployee,
  distributorCallList,
} = require('../controllers/report.controller');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.get('/summary', summary);
router.get('/by-employee', adminOnly, byEmployee);
router.get('/distributor-calls', distributorCallList);

module.exports = router;
