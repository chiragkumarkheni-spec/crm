const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { signToken } = require('../utils/token');

// Brute-force lockout settings: after this many wrong passwords in a row, the
// account is frozen for the cool-off window so a robot cannot keep guessing.
const MAX_LOGIN_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password, deviceId } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    res.status(400);
    throw new Error('Email and password are required');
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    '+passwordHash'
  );
  if (!user || !user.active) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  // If the account is currently locked from too many wrong attempts, refuse early
  // (without even checking the password) until the cool-off window passes.
  if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
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
    res.status(401);
    throw new Error('Invalid credentials');
  }

  // Correct password — clear any failed-attempt count / lock.
  if (user.failedLoginAttempts || user.lockUntil) {
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();
  }

  // DEVICE LOCK — employees (reps) can log in from only ONE PC. The first login
  // binds the account to that PC; afterwards any other PC is refused. Admins are
  // exempt so the owner can log in from anywhere. Admin can reset the bound PC.
  if (user.role === 'employee') {
    if (!deviceId) {
      res.status(400);
      throw new Error('Device pehchana nahi gaya. App dobara kholkar try karo.');
    }
    if (!user.deviceId) {
      user.deviceId = deviceId;
      user.deviceBoundAt = new Date();
      await user.save();
    } else if (user.deviceId !== deviceId) {
      res.status(403);
      throw new Error(
        'Aap sirf apne office PC se login kar sakte ho. Naye PC ke liye admin se device reset karwao.'
      );
    }
  }

  res.json({ token: signToken(user), user });
});

// GET /api/auth/me
const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

module.exports = { login, me };
