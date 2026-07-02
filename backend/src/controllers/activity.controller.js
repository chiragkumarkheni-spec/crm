const asyncHandler = require('express-async-handler');
const Activity = require('../models/Activity');
const User = require('../models/User');

const isAdmin = (user) => user.role === 'admin';

// Idle-rep detection thresholds (kept on the server so rep and admin agree).
const IDLE_MS = 30 * 60 * 1000; // no real action for 30 min = idle
const ONLINE_MS = 150 * 1000; // heartbeat seen within 2.5 min = app still open

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

// POST /api/activity/heartbeat  { idleMs }
// The app pings this every ~60s while it is open. `idleMs` = how long since the
// user's last real input. We record, on the SERVER clock (so all users are
// comparable regardless of PC clock), when the app was last seen open and when the
// user was last actually active. A tiny single-field write — safe to call often.
const heartbeat = asyncHandler(async (req, res) => {
  const now = Date.now();
  let idleMs = Number(req.body.idleMs);
  if (!Number.isFinite(idleMs) || idleMs < 0) idleMs = 0;
  idleMs = Math.min(idleMs, 24 * 3600 * 1000); // cap a bad client value
  await User.updateOne(
    { _id: req.user._id },
    { $set: { lastSeenAt: new Date(now), lastActiveAt: new Date(now - idleMs) } }
  );
  res.json({ ok: true });
});

// GET /api/activity/presence  (admin) — active employees with a computed
// online/idle flag, so the admin screen can show who is sitting idle (app open but
// no action for 30+ min). Computed server-side so the client needs no clock math.
const presence = asyncHandler(async (req, res) => {
  const now = Date.now();
  const users = await User.find({
    role: 'employee',
    active: true,
    deleted: { $ne: true },
  })
    .select('name lastSeenAt lastActiveAt')
    .lean();

  const list = users.map((u) => {
    const seenAgo = u.lastSeenAt ? now - new Date(u.lastSeenAt).getTime() : Infinity;
    const idleFor = u.lastActiveAt ? now - new Date(u.lastActiveAt).getTime() : Infinity;
    return {
      _id: u._id,
      name: u.name,
      online: seenAgo < ONLINE_MS,
      idle: seenAgo < ONLINE_MS && idleFor >= IDLE_MS,
      idleMs: Number.isFinite(idleFor) ? idleFor : null,
    };
  });
  res.json({ users: list });
});

module.exports = { listActivity, heartbeat, presence };
