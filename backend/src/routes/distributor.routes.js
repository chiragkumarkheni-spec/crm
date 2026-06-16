const express = require('express');
const {
  createDistributor,
  listDistributors,
  getDistributor,
  addDistributorCall,
} = require('../controllers/distributor.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.route('/').get(listDistributors).post(createDistributor);
router.get('/:id', getDistributor);
router.post('/:id/calls', addDistributorCall);

module.exports = router;
