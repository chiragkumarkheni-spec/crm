const asyncHandler = require('express-async-handler');
const Lead = require('../models/Lead');
const FollowUp = require('../models/FollowUp');
const { startOfDay, endOfDay, isToday } = require('../utils/date');
const { sendIntroMessage } = require('../services/whatsapp');

const isAdmin = (user) => user.role === 'admin';

// Can this user still edit this lead? Admin: always. Employee: only on the
// same day the lead was created (the "edit today's work only" rule).
function canEditLead(user, lead) {
  if (isAdmin(user)) return true;
  const owns =
    lead.assignedTo.toString() === user._id.toString() ||
    lead.createdBy.toString() === user._id.toString();
  return owns && isToday(lead.leadDate);
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
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Lead.countDocuments(filter),
  ]);

  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});

// ---------------------------------------------------------------------------
// GET /api/leads/today-followups — leads due for follow-up today (the screen)
// ---------------------------------------------------------------------------
const todayFollowUps = asyncHandler(async (req, res) => {
  const filter = {
    status: { $nin: ['converted', 'lost'] },
    // Show a lead on the daily screen if it is due/overdue for a follow-up OR
    // it is a brand-new lead that has never been worked (no next date yet) —
    // those still need their first call today.
    $or: [
      { nextFollowUpDate: { $lte: endOfDay() } },
      { nextFollowUpDate: null },
      { nextFollowUpDate: { $exists: false } },
    ],
  };
  if (!isAdmin(req.user)) filter.assignedTo = req.user._id;
  else if (req.query.employee) filter.assignedTo = req.query.employee;

  const leads = await Lead.find(filter)
    .populate('assignedTo', 'name email')
    .sort({ nextFollowUpDate: 1, createdAt: -1 });
  res.json(leads);
});

// ---------------------------------------------------------------------------
// GET /api/leads/:id — single lead with its follow-up history
// ---------------------------------------------------------------------------
const getLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id)
    .populate('assignedTo', 'name email')
    .populate('createdBy', 'name email');
  if (!lead) {
    res.status(404);
    throw new Error('Lead not found');
  }
  if (!isAdmin(req.user) && lead.assignedTo._id.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not your lead');
  }
  const followUps = await FollowUp.find({ lead: lead._id })
    .populate('employee', 'name')
    .sort({ date: -1, createdAt: -1 });
  res.json({ lead, followUps });
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
      'This lead can no longer be edited (only same-day edits are allowed)'
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
  if (!req.body.description) {
    res.status(400);
    throw new Error('Sample description is required');
  }
  lead.sampleRequest = {
    requested: true,
    description: req.body.description,
    date: new Date(),
  };
  await lead.save();
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

  res.status(201).json({ lead, followUp });
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
};
