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
const { validate, z } = require('../middleware/validate');

const router = express.Router();

const createDistributorSchema = z
  .object({
    name: z.string().min(1, 'Distributor name zaruri hai'),
    mobileNumber: z.string().min(1, 'Mobile number zaruri hai'),
  })
  .passthrough();

const distributorCallSchema = z
  .object({
    category: z.string().min(1, 'Call category zaruri hai'),
  })
  .passthrough();

router.use(protect);
router
  .route('/')
  .get(listDistributors)
  .post(validate(createDistributorSchema), createDistributor);
router.get('/today-followups', distributorFollowUps);
router.get('/:id', getDistributor);
router.post('/:id/calls', validate(distributorCallSchema), addDistributorCall);
router.patch('/:id/calls/:callId', editDistributorCall);

module.exports = router;
