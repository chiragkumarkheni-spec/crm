const asyncHandler = require('express-async-handler');
const Distributor = require('../models/Distributor');
const DistributorCall = require('../models/DistributorCall');
const { logActivity } = require('../utils/activity');
const { endOfDay } = require('../utils/date');
const { sanitizeNote } = require('../utils/sanitize');
const { escapeRegex } = require('../middleware/security');

const isAdmin = (user) => user.role === 'admin';

// POST /api/distributors — add a distributor (rep adds their existing one)
const createDistributor = asyncHandler(async (req, res) => {
  const { name, mobileNumber, companyName, email, city, state, address, notes, assignedTo } =
    req.body;
  if (!name || !name.trim()) {
    res.status(400);
    throw new Error('Distributor name is required');
  }
  if (!mobileNumber || !mobileNumber.trim()) {
    res.status(400);
    throw new Error('Mobile number is required');
  }
  // Only an admin may assign to someone else; otherwise the rep owns it.
  let owner = req.user._id;
  if (assignedTo && isAdmin(req.user)) owner = assignedTo;

  const distributor = await Distributor.create({
    name,
    mobileNumber,
    companyName,
    email,
    city,
    state,
    address,
    notes,
    assignedTo: owner,
    createdBy: req.user._id,
  });
  await logActivity({
    user: req.user,
    action: 'distributor_added',
    leadName: distributor.name,
    detail: distributor.mobileNumber,
  });
  res.status(201).json(distributor);
});

// GET /api/distributors — rep: own; admin: all (or one employee). Search + pages.
const listDistributors = asyncHandler(async (req, res) => {
  const { search, employee } = req.query;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

  const filter = { deleted: { $ne: true } };
  if (!isAdmin(req.user)) filter.assignedTo = req.user._id;
  else if (employee) filter.assignedTo = employee;
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { mobileNumber: rx }, { companyName: rx }];
  }

  const [items, total] = await Promise.all([
    Distributor.find(filter)
      .populate('assignedTo', 'name email')
      .sort({ lastCallAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Distributor.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});

// GET /api/distributors/:id — distributor + its call history
const getDistributor = asyncHandler(async (req, res) => {
  const [distributor, calls] = await Promise.all([
    Distributor.findById(req.params.id).populate('assignedTo', 'name email').lean(),
    DistributorCall.find({ distributor: req.params.id })
      .populate('employee', 'name')
      .sort({ date: -1, createdAt: -1 })
      .lean(),
  ]);
  if (!distributor) {
    res.status(404);
    throw new Error('Distributor not found');
  }
  if (
    !isAdmin(req.user) &&
    distributor.assignedTo._id.toString() !== req.user._id.toString()
  ) {
    res.status(403);
    throw new Error('Not your distributor');
  }
  res.json({ distributor, calls });
});

// POST /api/distributors/:id/calls — log a call/interaction
const addDistributorCall = asyncHandler(async (req, res) => {
  const distributor = await Distributor.findById(req.params.id);
  if (!distributor) {
    res.status(404);
    throw new Error('Distributor not found');
  }
  if (
    !isAdmin(req.user) &&
    distributor.assignedTo.toString() !== req.user._id.toString()
  ) {
    res.status(403);
    throw new Error('Not your distributor');
  }
  const { category, note, direction, orderValue, nextFollowUpDate } = req.body;
  if (!category) {
    res.status(400);
    throw new Error('Please choose a reason for the call.');
  }
  const amount = Number(orderValue) > 0 ? Number(orderValue) : 0;
  const call = await DistributorCall.create({
    distributor: distributor._id,
    employee: req.user._id,
    category,
    direction: direction === 'outgoing' ? 'outgoing' : 'incoming',
    note: sanitizeNote(note),
    orderValue: amount,
    date: new Date(),
  });
  distributor.lastCallAt = new Date();
  distributor.callCount = (distributor.callCount || 0) + 1;
  distributor.totalOrderValue = (distributor.totalOrderValue || 0) + amount;
  // Schedule the next distributor follow-up (separate from the lead pipeline).
  if (nextFollowUpDate) {
    distributor.nextFollowUpDate = new Date(nextFollowUpDate);
    distributor.followUpCount = (distributor.followUpCount || 0) + 1;
  }
  await distributor.save();
  await logActivity({
    user: req.user,
    action: 'distributor_call',
    leadName: distributor.name,
    detail:
      `${category.replace(/_/g, ' ')}` +
      `${amount ? ` · ₹${amount}` : ''}` +
      `${call.note ? ' · ' + call.note.replace(/<[^>]*>/g, '') : ''}`,
  });
  res.status(201).json(call);
});

// PATCH /api/distributors/:id/calls/:callId — correct a logged call within 24h.
//   A rep can fix the reason / call type / order amount / note for 24 hours;
//   admins anytime. The distributor's running order total is adjusted by the
//   change in order amount.
function within24h(date) {
  if (!date) return false;
  return (Date.now() - new Date(date).getTime()) / 3600000 <= 24;
}

const editDistributorCall = asyncHandler(async (req, res) => {
  const distributor = await Distributor.findById(req.params.id);
  if (!distributor) {
    res.status(404);
    throw new Error('Distributor not found');
  }
  const call = await DistributorCall.findOne({
    _id: req.params.callId,
    distributor: distributor._id,
  });
  if (!call) {
    res.status(404);
    throw new Error('Call not found');
  }
  const owns =
    call.employee.toString() === req.user._id.toString() ||
    distributor.assignedTo.toString() === req.user._id.toString();
  if (!isAdmin(req.user) && !owns) {
    res.status(403);
    throw new Error('Not your call');
  }
  if (!isAdmin(req.user) && !within24h(call.createdAt)) {
    res.status(403);
    throw new Error('Ye call sirf 24 ghante ke andar edit ho sakti hai');
  }

  const { category, direction, note, orderValue } = req.body;
  if (category !== undefined) call.category = category;
  if (direction !== undefined) {
    call.direction = direction === 'outgoing' ? 'outgoing' : 'incoming';
  }
  if (note !== undefined) call.note = sanitizeNote(note);

  // Order amount only applies to a "New order"; adjust the distributor's running
  // total by the difference (old → new).
  const oldAmount = call.orderValue || 0;
  let newAmount = oldAmount;
  if (orderValue !== undefined || category !== undefined) {
    newAmount =
      call.category === 'new_order' && Number(orderValue) > 0 ? Number(orderValue) : 0;
    call.orderValue = newAmount;
  }
  await call.save();

  if (newAmount !== oldAmount) {
    distributor.totalOrderValue = Math.max(
      0,
      (distributor.totalOrderValue || 0) - oldAmount + newAmount
    );
    await distributor.save();
  }

  await logActivity({
    user: req.user,
    action: 'distributor_call_edited',
    leadName: distributor.name,
    detail: `${call.category.replace(/_/g, ' ')}${newAmount ? ` · ₹${newAmount}` : ''}`,
  });
  res.json(call);
});

// GET /api/distributors/today-followups — distributors due for a follow-up
// today or overdue (their OWN pipeline, separate from leads).
const distributorFollowUps = asyncHandler(async (req, res) => {
  const filter = {
    deleted: { $ne: true },
    nextFollowUpDate: { $exists: true, $ne: null, $lte: endOfDay() },
  };
  if (!isAdmin(req.user)) filter.assignedTo = req.user._id;
  else if (req.query.employee) filter.assignedTo = req.query.employee;
  const items = await Distributor.find(filter)
    .populate('assignedTo', 'name')
    .sort({ nextFollowUpDate: 1 })
    .lean();
  res.json(items);
});

module.exports = {
  createDistributor,
  listDistributors,
  getDistributor,
  addDistributorCall,
  editDistributorCall,
  distributorFollowUps,
};
