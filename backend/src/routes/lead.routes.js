const express = require('express');
const {
  createLead,
  listLeads,
  todayFollowUps,
  getLead,
  updateLead,
  markCatalogueSent,
  markSampleSent,
  unmarkCatalogueSent,
  unmarkSampleSent,
  recordSampleRequest,
  addFollowUp,
  deleteLead,
  restoreLead,
  setStrong,
} = require('../controllers/lead.controller');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/').get(listLeads).post(createLead);
router.get('/today-followups', todayFollowUps);
router.get('/:id', getLead);
router.patch('/:id', updateLead);
router.post('/:id/catalogue', markCatalogueSent);
router.delete('/:id/catalogue', unmarkCatalogueSent);
router.post('/:id/sample', markSampleSent);
router.delete('/:id/sample', unmarkSampleSent);
router.post('/:id/sample-request', recordSampleRequest);
router.post('/:id/followups', addFollowUp);
router.post('/:id/strong', setStrong);
// Lead delete/restore are ADMIN ONLY (reps can never delete a lead).
router.delete('/:id', adminOnly, deleteLead);
router.post('/:id/restore', adminOnly, restoreLead);

module.exports = router;
