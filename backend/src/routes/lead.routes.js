const express = require('express');
const {
  createLead,
  listLeads,
  todayFollowUps,
  getLead,
  updateLead,
  markCatalogueSent,
  markSampleSent,
  recordSampleRequest,
  addFollowUp,
} = require('../controllers/lead.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/').get(listLeads).post(createLead);
router.get('/today-followups', todayFollowUps);
router.get('/:id', getLead);
router.patch('/:id', updateLead);
router.post('/:id/catalogue', markCatalogueSent);
router.post('/:id/sample', markSampleSent);
router.post('/:id/sample-request', recordSampleRequest);
router.post('/:id/followups', addFollowUp);

module.exports = router;
