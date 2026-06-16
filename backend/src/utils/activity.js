const Activity = require('../models/Activity');

// Record one audit-trail entry. Never throws — logging must not break the action
// it is recording. Fire-and-forget friendly (callers may omit `await`).
async function logActivity({ user, action, lead, leadName, detail }) {
  try {
    await Activity.create({
      user: user._id,
      userName: user.name,
      action,
      lead: lead ? lead._id || lead : undefined,
      leadName: leadName || (lead && lead.name) || undefined,
      detail,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('activity log failed:', err.message);
  }
}

module.exports = { logActivity };
