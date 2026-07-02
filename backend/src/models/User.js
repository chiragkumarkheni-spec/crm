const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['employee', 'admin'],
      default: 'employee',
    },
    active: { type: Boolean, default: true },
    // Device lock (employees only): a rep's login is bound to ONE PC. The first
    // successful login stores that PC's deviceId; afterwards only that PC can log
    // in. Admin can reset it (clear deviceId) when the rep moves to a new PC.
    deviceId: { type: String, default: null },
    deviceBoundAt: { type: Date },
    // Brute-force protection: count consecutive wrong-password attempts and, after
    // too many, lock the account for a short cool-off window. Cleared on success.
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    // Optional two-factor auth (TOTP / authenticator app). The secret is hidden by
    // default; `twoFactorEnabled` flips on only after the user confirms a code.
    twoFactorSecret: { type: String, select: false },
    twoFactorEnabled: { type: Boolean, default: false },
    // Presence (idle-rep detection): `lastSeenAt` = when the app last sent a
    // heartbeat (i.e. it is open), `lastActiveAt` = when the user last did a real
    // action (mouse/keyboard). Both stamped on the SERVER clock so they stay
    // comparable across PCs. Used to flag a rep sitting idle during working hours.
    lastSeenAt: { type: Date },
    lastActiveAt: { type: Date },
    // Soft delete: a "deleted" user is moved to the Recycle Bin (hidden from
    // the main list and unable to log in) but never removed from the database.
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

// Set password (hashes it). Use instead of assigning passwordHash directly.
userSchema.methods.setPassword = async function setPassword(plain) {
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(plain, salt);
};

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

// Never leak the hash in JSON responses.
userSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.twoFactorSecret;
  return obj;
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
