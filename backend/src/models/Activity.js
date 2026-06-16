const mongoose = require('mongoose');

// A simple audit trail: one row per meaningful action a user takes, so anyone
// can recall "who did what, and when". Names are denormalized so the log still
// reads correctly even if a lead/user is later renamed or removed.
const activitySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userName: { type: String, trim: true },
    action: { type: String, required: true }, // e.g. lead_created, followup, lead_deleted
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    leadName: { type: String, trim: true },
    detail: { type: String, trim: true }, // human-readable extra (outcome, next date, etc.)
  },
  { timestamps: true }
);

activitySchema.index({ createdAt: -1 });
activitySchema.index({ user: 1, createdAt: -1 });

module.exports =
  mongoose.models.Activity || mongoose.model('Activity', activitySchema);
