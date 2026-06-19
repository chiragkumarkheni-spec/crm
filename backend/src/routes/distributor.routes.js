const express = require('express');
const {
  createDistributor,
  listDistributors,
  getDistributor,
  addDistributorCall,
  editDistributorCall,
  distributorFollowUps,
} = require('../controllers/distributor.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.route('/').get(listDistributors).post(createDistributor);
router.get('/today-followups', distributorFollowUps);
router.get('/:id', getDistributor);
router.post('/:id/calls', addDistributorCall);
router.patch('/:id/calls/:callId', editDistributorCall);

module.exports = router;
