const asyncHandler = require('express-async-handler');
const Activity = require('../models/Activity');

const isAdmin = (user) => user.role === 'admin';

// GET /api/activity?employee=&limit=
//   Rep: only their own actions. Admin: everyone's (or one employee's).
const listActivity = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 150, 500);
  const filter = {};
  if (!isAdmin(req.user)) {
    filter.user = req.user._id;
  } else if (req.query.employee) {
    filter.user = req.query.employee;
  }
  const items = await Activity.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  res.json({ items });
});

module.exports = { listActivity };
