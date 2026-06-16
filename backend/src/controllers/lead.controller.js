const asyncHandler = require('express-async-handler');
const Lead = require('../models/Lead');
const FollowUp = require('../models/FollowUp');
const DistributorCall = require('../models/DistributorCall');
const { startOfDay, endOfDay, isToday } = require('../utils/date');
const { sendIntroMessage } = require('../services/whatsapp');
const { logActivity } = require('../utils/activity');

const isAdmin = (user) => user.role === 'admin';

// Lead edit windows, measured from when the lead was created:
//   - the rep who owns the lead can edit it for 36 hours
//   - an admin can edit it for 100 hours
//   - after that nobody can edit it
const REP_EDIT_HOURS = 36;
const ADMIN_EDIT_HOURS = 100;

function hoursSince(date) {
  return (Date.now() - new Date(date).getTime()) / 3600000;
}

// Can this user still edit this lead?
function canEditLead(user, lead) {
  const hrs = hoursSince(lead.createdAt || lead.leadDate);
  if (isAdmin(user)) return hrs <= ADMIN_EDIT_HOURS;
  const owns =
    lead.assignedTo.toString() === user._id.toString() ||
    lead.createdBy.toString() === user._id.toString();
  return owns && hrs <= REP_EDIT_HOURS;
}

// ---------------------------------------------------------------------------
// POST /api/leads — create a lead (current date only, no back-dating)
// ---------------------------------------------------------------------------
const createLead = asyncHandler(async (req, res) => {
  const {
    name,
    companyName,
    mobileNumber,
    email,
    address,
    city,
    state,
    product,
    quantity,
    requirement,
    source,
    assignedTo,
  } = req.body;
  if (!name || !name.trim()) {
    res.status(400);
    throw new Error('Buyer name is required');
  }
  if (!mobileNumber || !mobileNumber.trim()) {
    res.status(400);
    throw new Error('Mobile number is required');
  }
  if (!/^\d{10}$/.test(mobileNumber.trim())) {
    res.status(400);
    throw new Error('Mobile number must be exactly 10 digits');
  }

  // Lead date is always "today" on the server — back-dated leads are not allowed.
  const leadDate = new Date();

  // Only an admin may assign the lead to someone else; employees own their own.
  let owner = req.user._id;
  if (assignedTo && isAdmin(req.user)) owner = assignedTo;

  const lead = await Lead.create({
    name,
    companyName,
    mobileNumber,
    email,
    address,
    city,
    state,
    product,
    quantity,
    requirement,
    source: source || 'IndiaMart',
    createdBy: req.user._id,
    assignedTo: owner,
    leadDate,
    status: 'new',
  });

  await logActivity({ user: req.user, action: 'lead_created', lead, detail: lead.mobileNumber });
  res.status(201).json(lead);
});

// ---------------------------------------------------------------------------
// GET /api/leads — list leads (employee: own; admin: all) with filters
//   query: status, state, from, to, employee (admin), search, page, limit
// ---------------------------------------------------------------------------
const listLeads = asyncHandler(async (req, res) => {
  const { status, state, from, to, employee, search } = req.query;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);

  const filter = {};
  if (!isAdmin(req.user)) {
    filter.assignedTo = req.user._id;
  } else if (employee) {
    filter.assignedTo = employee;
  }
  // Recycle Bin: only an admin can list deleted leads; everyone else (and the
  // admin's normal view) always excludes deleted leads.
  const wantDeleted = isAdmin(req.user) && req.query.deleted === 'true';
  filter.deleted = wantDeleted ? true : { $ne: true };
  if (status) filter.status = status;
  if (state) filter.state = state;
  if (from || to) {
    filter.leadDate = {};
    if (from) filter.leadDate.$gte = startOfDay(new Date(from));
    if (to) filter.leadDate.$lte = endOfDay(new Date(to));
  }
  if (search) {
    filter.$or = [
      { name: new RegExp(search, 'i') },
      { companyName: new RegExp(search, 'i') },
      { mobileNumber: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') },
      { product: new RegExp(search, 'i') },
    ];
  }

  const [items, total] = await Promise.all([
    Lead.find(filter)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .sort(wantDeleted ? { deletedAt: -1 } : { createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Lead.countDocuments(filter),
  ]);

  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});

// ---------------------------------------------------------------------------
// GET /api/leads/today-followups — leads due for follow-up today (the screen)
// ---------------------------------------------------------------------------
const todayFollowUps = asyncHandler(async (req, res) => {
  // Only SCHEDULED follow-ups that are due today or overdue. Brand-new leads
  // (no scheduled follow-up time) are NOT reminders — they are the backlog that
  // reps work from the Leads list, so they must not flood the "Call now" alert.
  const filter = {
    status: { $nin: ['converted', 'lost'] },
    deleted: { $ne: true },
    nextFollowUpDate: { $exists: true, $ne: null, $lte: endOfDay() },
  };
  if (!isAdmin(req.user)) filter.assignedTo = req.user._id;
  else if (req.query.employee) filter.assignedTo = req.query.employee;

  const leads = await Lead.find(filter)
    .populate('assignedTo', 'name email')
    .sort({ nextFollowUpDate: 1, createdAt: -1 })
    .lean();
  res.json(leads);
});

// ---------------------------------------------------------------------------
// GET /api/leads/:id — single lead with its follow-up history
// ---------------------------------------------------------------------------
const getLead = asyncHandler(async (req, res) => {
  // Fetch the lead and its follow-up history in parallel (the history is keyed
  // by the lead id from the URL, so it doesn't need to wait for the lead query).
  const [lead, followUps, distributorCalls] = await Promise.all([
    Lead.findById(req.params.id)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .lean(),
    FollowUp.find({ lead: req.params.id })
      .populate('employee', 'name')
      .sort({ date: -1, createdAt: -1 })
      .lean(),
    DistributorCall.find({ lead: req.params.id })
      .populate('employee', 'name')
      .sort({ date: -1, createdAt: -1 })
      .lean(),
  ]);
  if (!lead) {
    res.status(404);
    throw new Error('Lead not found');
  }
  if (!isAdmin(req.user) && lead.assignedTo._id.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not your lead');
  }
  res.json({ lead, followUps, distributorCalls });
});

// ---------------------------------------------------------------------------
// PATCH /api/leads/:id — edit lead detail (subject to the daily edit lock)
// ---------------------------------------------------------------------------
const updateLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) {
    res.status(404);
    throw new Error('Lead not found');
  }
  if (!canEditLead(req.user, lead)) {
    res.status(403);
    throw new Error(
      isAdmin(req.user)
        ? 'This lead can no longer be edited (the 100-hour admin edit window has passed)'
        : 'This lead can no longer be edited (the 36-hour edit window has passed)'
    );
  }
  const editable = [
    'name',
    'companyName',
    'mobileNumber',
    'email',
    'address',
    'city',
    'state',
    'product',
    'quantity',
    'requirement',
    'source',
    'notes',
  ];
  for (const f of editable) {
    if (req.body[f] !== undefined) lead[f] = req.body[f];
  }
  // Admin may reassign.
  if (isAdmin(req.user) && req.body.assignedTo) lead.assignedTo = req.body.assignedTo;
  await lead.save();
  await logActivity({ user: req.user, action: 'lead_edited', lead });
  res.json(lead);
});

// ---------------------------------------------------------------------------
// POST /api/leads/:id/catalogue — mark catalogue sent (one time)
// ---------------------------------------------------------------------------
const markCatalogueSent = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) {
    res.status(404);
    throw new Error('Lead not found');
  }
  if (lead.catalogue.sent) {
    res.status(400);
    throw new Error('Catalogue already sent to this lead');
  }
  lead.catalogue = { sent: true, date: new Date() };
  await lead.save();
  await logActivity({ user: req.user, action: 'catalogue_sent', lead });
  res.json(lead);
});

// ---------------------------------------------------------------------------
// POST /api/leads/:id/sample — mark a sample sent (one time) with description
// ---------------------------------------------------------------------------
const markSampleSent = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) {
    res.status(404);
    throw new Error('Lead not found');
  }
  if (lead.sample.sent) {
    res.status(400);
    throw new Error('A sample has already been sent to this lead');
  }
  lead.sample = {
    sent: true,
    date: new Date(),
    description: req.body.description || lead.sampleRequest?.description || '',
  };
  await lead.save();
  await logActivity({ user: req.user, action: 'sample_sent', lead, detail: lead.sample.description });
  res.json(lead);
});

// ---------------------------------------------------------------------------
// POST /api/leads/:id/sample-request — record a sample the lead asked for
// ---------------------------------------------------------------------------
const recordSampleRequest = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) {
    res.status(404);
    throw new Error('Lead not found');
  }
  // Must own the lead (admins can always touch it).
  const owns =
    lead.assignedTo.toString() === req.user._id.toString() ||
    lead.createdBy.toString() === req.user._id.toString();
  if (!isAdmin(req.user) && !owns) {
    res.status(403);
    throw new Error('Not your lead');
  }
  // Same-day edit lock: an employee may add or edit the sample request only on
  // the day it was recorded. Once that day passes it is locked (admin exempt).
  if (
    !isAdmin(req.user) &&
    lead.sampleRequest?.requested &&
    lead.sampleRequest.date &&
    !isToday(lead.sampleRequest.date)
  ) {
    res.status(403);
    throw new Error(
      'Sample request can only be edited on the same day it was recorded'
    );
  }
  if (!req.body.description || !req.body.description.trim()) {
    res.status(400);
    throw new Error('Sample description is required');
  }
  lead.sampleRequest = {
    requested: true,
    description: req.body.description.trim(),
    date: new Date(),
  };
  await lead.save();
  await logActivity({ user: req.user, action: 'sample_request', lead, detail: lead.sampleRequest.description });
  res.json(lead);
});

// ---------------------------------------------------------------------------
// POST /api/leads/:id/followups — record a follow-up / call
//   body: outcome (required), development (required), nextFollowUpDate?,
//         orderValue? (required when outcome=converted),
//         catalogueSent?, sampleSent?, sampleDescription?
// ---------------------------------------------------------------------------
const addFollowUp = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) {
    res.status(404);
    throw new Error('Lead not found');
  }
  if (!isAdmin(req.user) && lead.assignedTo.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not your lead');
  }

  const { outcome, development, nextFollowUpDate, orderValue } = req.body;
  if (!outcome || !development) {
    res.status(400);
    throw new Error('outcome and development are required');
  }
  if (outcome === 'converted' && (orderValue === undefined || orderValue === null)) {
    res.status(400);
    throw new Error('orderValue is required when converting a lead');
  }

  const now = new Date();

  // Optional one-time catalogue/sample actions taken on this call.
  let catalogueSent = false;
  let sampleSent = false;
  if (req.body.catalogueSent && !lead.catalogue.sent) {
    lead.catalogue = { sent: true, date: now };
    catalogueSent = true;
  }
  if (req.body.sampleSent && !lead.sample.sent) {
    lead.sample = {
      sent: true,
      date: now,
      description: req.body.sampleDescription || '',
    };
    sampleSent = true;
  }

  // This becomes the Nth follow-up.
  const followUpNumber = lead.followUpCount + 1;

  // One-time automated WhatsApp on the 2nd follow-up.
  let whatsAppSent = false;
  if (followUpNumber === 2 && !lead.whatsApp.sent) {
    try {
      const result = await sendIntroMessage({
        to: lead.mobileNumber,
        leadName: lead.name,
      });
      lead.whatsApp = { sent: true, date: now, messageId: result.id };
      whatsAppSent = true;
    } catch (err) {
      // Don't fail the follow-up if WhatsApp send fails; just log it.
      // eslint-disable-next-line no-console
      console.error('WhatsApp send failed:', err.message);
    }
  }

  const followUp = await FollowUp.create({
    lead: lead._id,
    employee: req.user._id,
    date: now,
    outcome,
    development,
    nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : undefined,
    orderValue: outcome === 'converted' ? Number(orderValue) : undefined,
    catalogueSent,
    sampleSent,
    whatsAppSent,
  });

  // Update lead pipeline state.
  lead.status = outcome;
  lead.followUpCount = followUpNumber;
  lead.lastFollowUpAt = now;
  lead.nextFollowUpDate = nextFollowUpDate ? new Date(nextFollowUpDate) : undefined;
  if (outcome === 'converted') {
    lead.convertedAt = now;
    lead.order = {
      value: Number(orderValue),
      currency: lead.order?.currency || 'INR',
      note: req.body.orderNote || '',
    };
    lead.nextFollowUpDate = undefined;
  }
  await lead.save();

  let detail = outcome.replace(/_/g, ' ');
  if (outcome === 'converted') detail = `converted · ₹${Number(orderValue)}`;
  else if (nextFollowUpDate)
    detail += ` · next ${new Date(nextFollowUpDate).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  await logActivity({ user: req.user, action: 'followup', lead, detail });

  res.status(201).json({ lead, followUp });
});

// ---------------------------------------------------------------------------
// DELETE /api/leads/:id — admin-only soft delete → Lead Recycle Bin.
// The lead is hidden everywhere but kept in the database; it can be restored
// later but never permanently removed.
// ---------------------------------------------------------------------------
const deleteLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) {
    res.status(404);
    throw new Error('Lead not found');
  }
  lead.deleted = true;
  lead.deletedAt = new Date();
  await lead.save();
  await logActivity({ user: req.user, action: 'lead_deleted', lead });
  res.json({ success: true, _id: lead._id });
});

// ---------------------------------------------------------------------------
// POST /api/leads/:id/restore — admin-only restore from the Recycle Bin.
// ---------------------------------------------------------------------------
const restoreLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) {
    res.status(404);
    throw new Error('Lead not found');
  }
  lead.deleted = false;
  lead.deletedAt = undefined;
  await lead.save();
  await logActivity({ user: req.user, action: 'lead_restored', lead });
  res.json({ success: true, _id: lead._id });
});

// ---------------------------------------------------------------------------
// POST /api/leads/:id/distributor-calls — log a call/interaction with an
// EXISTING distributor (a converted lead). Kept separate from lead follow-ups
// so distributor servicing and lead-chasing never get mixed up.
// ---------------------------------------------------------------------------
const addDistributorCall = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) {
    res.status(404);
    throw new Error('Lead not found');
  }
  if (!isAdmin(req.user) && lead.assignedTo.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not your distributor');
  }
  if (lead.status !== 'converted') {
    res.status(400);
    throw new Error('This is not a distributor yet (the lead is not converted).');
  }
  const { category, note, direction } = req.body;
  if (!category) {
    res.status(400);
    throw new Error('Please choose a category for the call.');
  }
  const call = await DistributorCall.create({
    lead: lead._id,
    employee: req.user._id,
    category,
    direction: direction === 'outgoing' ? 'outgoing' : 'incoming',
    note: note ? String(note).trim() : '',
    date: new Date(),
  });
  await logActivity({
    user: req.user,
    action: 'distributor_call',
    lead,
    detail: `${category.replace(/_/g, ' ')}${note ? ' · ' + note : ''}`,
  });
  res.status(201).json(call);
});

module.exports = {
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
};
