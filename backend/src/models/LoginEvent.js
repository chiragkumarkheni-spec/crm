const mongoose = require('mongoose');

// A security log of every login ATTEMPT (success and failure) so an admin can
// spot suspicious activity — repeated wrong passwords, logins from a new device,
// odd hours, etc. Kept separate from the lead Activity log on purpose.
const loginEventSchema = new mongoose.Schema(
  {
    email: { type: String, trim: true, lowercase: true }, // what was typed (even if wrong)
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // matched user, if any
    userName: { type: String, trim: true },
    success: { type: Boolean, default: false, index: true },
    // ok | bad_password | locked | wrong_device | no_device | unknown_or_inactive
    reason: { type: String },
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true }
);

loginEventSchema.index({ createdAt: -1 });
// Auto-purge entries older than 90 days so the log never grows unbounded.
loginEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

module.exports =
  mongoose.models.LoginEvent || mongoose.model('LoginEvent', loginEventSchema);
