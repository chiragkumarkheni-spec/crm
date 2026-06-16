const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const FollowUp = require('../models/FollowUp');
const { startOfDay, endOfDay } = require('../utils/date');

const isAdmin = (user) => user.role === 'admin';

function rangeFromQuery(q) {
  const to = q.to ? endOfDay(new Date(q.to)) : endOfDay();
  // default range: last 30 days
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 29);
  const from = q.from ? startOfDay(new Date(q.from)) : startOfDay(defaultFrom);
  return { from, to };
}

// ---------------------------------------------------------------------------
// GET /api/reports/summary?from&to&employee
//   Activity + outcome counts based on follow-ups (calls), plus conversions
//   and total order value. Employees see only their own numbers.
// ---------------------------------------------------------------------------
const summary = asyncHandler(async (req, res) => {
  const { from, to } = rangeFromQuery(req.query);

  const followMatch = { date: { $gte: from, $lte: to } };
  if (!isAdmin(req.user)) {
    followMatch.employee = req.user._id;
  } else if (req.query.employee) {
    followMatch.employee = new mongoose.Types.ObjectId(req.query.employee);
  }

  // Conversions + order value from leads converted in range.
  const leadMatch = { convertedAt: { $gte: from, $lte: to } };
  if (!isAdmin(req.user)) {
    leadMatch.assignedTo = req.user._id;
  } else if (req.query.employee) {
    leadMatch.assignedTo = new mongoose.Types.ObjectId(req.query.employee);
  }

  // New leads created in range.
  const newLeadMatch = { leadDate: { $gte: from, $lte: to } };
  if (!isAdmin(req.user)) newLeadMatch.assignedTo = req.user._id;
  else if (req.query.employee)
    newLeadMatch.assignedTo = new mongoose.Types.ObjectId(req.query.employee);

  // These three are independent — run them in parallel instead of one-by-one.
  const [outcomeAgg, convAgg, newLeads] = await Promise.all([
    FollowUp.aggregate([
      { $match: followMatch },
      { $group: { _id: '$outcome', count: { $sum: 1 } } },
    ]),
    Lead.aggregate([
      { $match: leadMatch },
      {
        $group: {
          _id: null,
          conversions: { $sum: 1 },
          orderValue: { $sum: '$order.value' },
        },
      },
    ]),
    Lead.countDocuments(newLeadMatch),
  ]);

  const outcomes = {
    in_progress: 0,
    no_pickup: 0,
    high_rate: 0,
    no_capacity: 0,
    retail_enquiry: 0,
    converted: 0,
    lost: 0,
  };
  let totalCalls = 0;
  outcomeAgg.forEach((o) => {
    outcomes[o._id] = o.count;
    totalCalls += o.count;
  });

  const conversions = convAgg[0]?.conversions || 0;
  const orderValue = convAgg[0]?.orderValue || 0;

  res.json({
    range: { from, to },
    newLeads,
    totalCalls,
    outcomes,
    conversions,
    orderValue,
  });
});

// ---------------------------------------------------------------------------
// GET /api/reports/by-employee?from&to   (admin only)
//   One row per employee with their activity, outcomes, conversions & order $.
// ---------------------------------------------------------------------------
const byEmployee = asyncHandler(async (req, res) => {
  const { from, to } = rangeFromQuery(req.query);

  // Three independent aggregations run in parallel:
  //  - calls/outcomes (follow-ups) within the selected period
  //  - conversions + order value (leads converted) within the period
  //  - lead INVENTORY per rep (all-time, status-wise: how many leads each holds)
  const [calls, conv, leadInv] = await Promise.all([
    FollowUp.aggregate([
      { $match: { date: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: '$employee',
          totalCalls: { $sum: 1 },
          no_pickup: { $sum: { $cond: [{ $eq: ['$outcome', 'no_pickup'] }, 1, 0] } },
          high_rate: { $sum: { $cond: [{ $eq: ['$outcome', 'high_rate'] }, 1, 0] } },
          no_capacity: { $sum: { $cond: [{ $eq: ['$outcome', 'no_capacity'] }, 1, 0] } },
          retail_enquiry: { $sum: { $cond: [{ $eq: ['$outcome', 'retail_enquiry'] }, 1, 0] } },
          in_progress: { $sum: { $cond: [{ $eq: ['$outcome', 'in_progress'] }, 1, 0] } },
          converted: { $sum: { $cond: [{ $eq: ['$outcome', 'converted'] }, 1, 0] } },
        },
      },
    ]),
    Lead.aggregate([
      { $match: { convertedAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: '$assignedTo',
          conversions: { $sum: 1 },
          orderValue: { $sum: '$order.value' },
        },
      },
    ]),
    Lead.aggregate([
      { $match: { deleted: { $ne: true } } },
      {
        $group: {
          _id: '$assignedTo',
          leadsTotal: { $sum: 1 },
          leadsNew: { $sum: { $cond: [{ $eq: ['$status', 'new'] }, 1, 0] } },
          leadsInProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
          leadsConverted: { $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] } },
          leadsLost: { $sum: { $cond: [{ $eq: ['$status', 'lost'] }, 1, 0] } },
        },
      },
    ]),
  ]);
  const convMap = new Map(conv.map((c) => [String(c._id), c]));
  const invMap = new Map(leadInv.map((c) => [String(c._id), c]));

  // Merge, attach user names. A rep appears if they have leads OR activity.
  const ids = new Set([
    ...calls.map((c) => String(c._id)),
    ...conv.map((c) => String(c._id)),
    ...leadInv.map((c) => String(c._id)),
  ]);
  const User = require('../models/User');
  const users = await User.find({ _id: { $in: [...ids] } })
    .select('name email')
    .lean();
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const rows = [...ids].map((id) => {
    const c = calls.find((x) => String(x._id) === id) || {};
    const cv = convMap.get(id) || {};
    const inv = invMap.get(id) || {};
    const u = userMap.get(id);
    return {
      employee: u ? { _id: u._id, name: u.name, email: u.email } : { _id: id },
      // Lead inventory (all-time)
      leadsTotal: inv.leadsTotal || 0,
      leadsNew: inv.leadsNew || 0,
      leadsInProgress: inv.leadsInProgress || 0,
      leadsConverted: inv.leadsConverted || 0,
      leadsLost: inv.leadsLost || 0,
      // Activity (selected period)
      totalCalls: c.totalCalls || 0,
      no_pickup: c.no_pickup || 0,
      high_rate: c.high_rate || 0,
      no_capacity: c.no_capacity || 0,
      retail_enquiry: c.retail_enquiry || 0,
      in_progress: c.in_progress || 0,
      conversions: cv.conversions || 0,
      orderValue: cv.orderValue || 0,
    };
  });

  rows.sort(
    (a, b) =>
      b.leadsTotal - a.leadsTotal ||
      b.conversions - a.conversions ||
      b.totalCalls - a.totalCalls
  );

  res.json({ range: { from, to }, rows });
});

module.exports = { summary, byEmployee };
