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
  editFollowUp,
  recordSampleRequest,
  addFollowUp,
  deleteLead,
  restoreLead,
  setStrong,
} = require('../controllers/lead.controller');
const { protect, adminOnly } = require('../middleware/auth');
const { validate, z } = require('../middleware/validate');

const router = express.Router();

const createLeadSchema = z
  .object({
    name: z.string().min(1, 'Buyer name zaruri hai'),
    mobileNumber: z.string().min(1, 'Mobile number zaruri hai'),
  })
  .passthrough();

const followUpSchema = z
  .object({
    outcome: z.string().min(1, 'Outcome zaruri hai'),
    development: z.string().min(1, 'Development / note zaruri hai'),
  })
  .passthrough();

router.use(protect);

router.route('/').get(listLeads).post(validate(createLeadSchema), createLead);
router.get('/today-followups', todayFollowUps);
router.get('/:id', getLead);
router.patch('/:id', updateLead);
router.post('/:id/catalogue', markCatalogueSent);
router.delete('/:id/catalogue', unmarkCatalogueSent);
router.post('/:id/sample', markSampleSent);
router.delete('/:id/sample', unmarkSampleSent);
router.post('/:id/sample-request', recordSampleRequest);
router.post('/:id/followups', validate(followUpSchema), addFollowUp);
router.patch('/:id/followups/:fid', editFollowUp);
router.post('/:id/strong', setStrong);
// Lead delete/restore are ADMIN ONLY (reps can never delete a lead).
router.delete('/:id', adminOnly, deleteLead);
router.post('/:id/restore', adminOnly, restoreLead);

module.exports = router;
