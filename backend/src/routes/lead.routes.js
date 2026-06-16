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
  deleteLead,
  restoreLead,
  addDistributorCall,
} = require('../controllers/lead.controller');
const { protect, adminOnly } = require('../middleware/auth');

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
router.post('/:id/distributor-calls', addDistributorCall);
// Lead delete/restore are ADMIN ONLY (reps can never delete a lead).
router.delete('/:id', adminOnly, deleteLead);
router.post('/:id/restore', adminOnly, restoreLead);

module.exports = router;
