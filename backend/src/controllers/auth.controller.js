const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { signToken } = require('../utils/token');

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password, deviceId } = req.body;
  if (!email || !password) {
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

  const ok = await user.comparePassword(password);
  if (!ok) {
    res.status(401);
    throw new Error('Invalid credentials');
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
