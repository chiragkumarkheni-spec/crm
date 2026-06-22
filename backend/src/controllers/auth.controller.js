const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const LoginEvent = require('../models/LoginEvent');
const { signToken } = require('../utils/token');
const { passwordError } = require('../utils/password');
const { generateSecret, otpauthURL, verifyToken } = require('../utils/twofactor');

// Brute-force lockout settings: after this many wrong passwords in a row, the
// account is frozen for the cool-off window so a robot cannot keep guessing.
const MAX_LOGIN_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

// Record one login attempt (success or failure) for the security log. Awaited so
// the entry is persisted before we respond, but wrapped so it can NEVER break login.
async function recordLogin(req, { email, user, success, reason }) {
  try {
    await LoginEvent.create({
      email: (email || '').toLowerCase(),
      user: user ? user._id : undefined,
      userName: user ? user.name : undefined,
      success,
      reason,
      ip: req.ip,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
    });
  } catch {
    /* logging must never block a login */
  }
}

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password, deviceId } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    res.status(400);
    throw new Error('Email and password are required');
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    '+passwordHash +twoFactorSecret'
  );
  if (!user || !user.active) {
    await recordLogin(req, { email, success: false, reason: 'unknown_or_inactive' });
    res.status(401);
    throw new Error('Invalid credentials');
  }

  // If the account is currently locked from too many wrong attempts, refuse early
  // (without even checking the password) until the cool-off window passes.
  if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
    await recordLogin(req, { email, user, success: false, reason: 'locked' });
    const mins = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
    res.status(429);
    throw new Error(
      `Bahut baar galat password. Account ${mins} minute ke liye lock hai — thodi der baad try karo.`
    );
  }

  const ok = await user.comparePassword(password);
  if (!ok) {
    // Wrong password — count it, and lock the account if the limit is crossed.
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60000);
      user.failedLoginAttempts = 0; // reset the counter; the lock now applies
    }
    await user.save();
    await recordLogin(req, { email, user, success: false, reason: 'bad_password' });
    res.status(401);
    throw new Error('Invalid credentials');
  }

  // Correct password — clear any failed-attempt count / lock.
  if (user.failedLoginAttempts || user.lockUntil) {
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();
  }

  // TWO-FACTOR (optional, per user). If on, a valid authenticator-app code is
  // required before we issue a token or bind a device. The frontend shows a code
  // box when it sees { twoFactorRequired: true } and re-submits with `code`.
  if (user.twoFactorEnabled) {
    const code = req.body.code;
    if (!code || !verifyToken(user.twoFactorSecret, code)) {
      await recordLogin(req, {
        email,
        user,
        success: false,
        reason: code ? '2fa_bad' : '2fa_required',
      });
      return res.json({ twoFactorRequired: true, invalidCode: !!code });
    }
  }

  // DEVICE LOCK — employees (reps) can log in from only ONE PC. The first login
  // binds the account to that PC; afterwards any other PC is refused. Admins are
  // exempt so the owner can log in from anywhere. Admin can reset the bound PC.
  if (user.role === 'employee') {
    if (!deviceId) {
      await recordLogin(req, { email, user, success: false, reason: 'no_device' });
      res.status(400);
      throw new Error('Device pehchana nahi gaya. App dobara kholkar try karo.');
    }
    if (!user.deviceId) {
      user.deviceId = deviceId;
      user.deviceBoundAt = new Date();
      await user.save();
    } else if (user.deviceId !== deviceId) {
      await recordLogin(req, { email, user, success: false, reason: 'wrong_device' });
      res.status(403);
      throw new Error(
        'Aap sirf apne office PC se login kar sakte ho. Naye PC ke liye admin se device reset karwao.'
      );
    }
  }

  await recordLogin(req, { email, user, success: true, reason: 'ok' });
  res.json({ token: signToken(user), user });
});

// GET /api/auth/me
const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/change-password — a logged-in user changes their OWN password.
//   body: { currentPassword, newPassword }
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error('Current aur naya password dono chahiye');
  }
  // Re-fetch WITH the hash (it is select:false by default).
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  const ok = await user.comparePassword(currentPassword);
  if (!ok) {
    res.status(401);
    throw new Error('Current password galat hai');
  }
  const weak = passwordError(newPassword);
  if (weak) {
    res.status(400);
    throw new Error(weak);
  }
  if (await user.comparePassword(newPassword)) {
    res.status(400);
    throw new Error('Naya password purane se alag hona chahiye');
  }
  await user.setPassword(newPassword);
  // A fresh password clears any brute-force lock/counter.
  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  await user.save();
  res.json({ success: true });
});

// GET /api/auth/login-events  (admin) — recent login attempts for the security log.
const getLoginEvents = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const items = await LoginEvent.find({}).sort({ createdAt: -1 }).limit(limit).lean();
  res.json({ items });
});

// --- Optional two-factor (TOTP / authenticator app), self-service ---

// POST /api/auth/2fa/setup — make a fresh secret and return its QR (otpauth) URI.
// Not enabled yet: the user must confirm a code via /enable.
const twoFactorSetup = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+twoFactorSecret');
  const secret = generateSecret();
  user.twoFactorSecret = secret;
  user.twoFactorEnabled = false;
  await user.save();
  res.json({ secret, otpauthUrl: otpauthURL(user.email, secret) });
});

// POST /api/auth/2fa/enable { code } — verify the first code, then switch 2FA on.
const twoFactorEnable = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+twoFactorSecret');
  if (!user.twoFactorSecret) {
    res.status(400);
    throw new Error('Pehle setup karo, phir code daalo');
  }
  if (!verifyToken(user.twoFactorSecret, req.body.code)) {
    res.status(400);
    throw new Error('Code galat hai — app me jo 6 digit dikh raha hai wahi daalo');
  }
  user.twoFactorEnabled = true;
  await user.save();
  res.json({ success: true });
});

// POST /api/auth/2fa/disable { code } — turn 2FA off (needs a valid current code).
const twoFactorDisable = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+twoFactorSecret');
  if (!user.twoFactorEnabled) {
    return res.json({ success: true });
  }
  if (!verifyToken(user.twoFactorSecret, req.body.code)) {
    res.status(400);
    throw new Error('Code galat hai');
  }
  user.twoFactorEnabled = false;
  user.twoFactorSecret = undefined;
  await user.save();
  res.json({ success: true });
});

module.exports = {
  login,
  me,
  changePassword,
  getLoginEvents,
  twoFactorSetup,
  twoFactorEnable,
  twoFactorDisable,
};
