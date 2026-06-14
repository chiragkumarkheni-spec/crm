const asyncHandler = require('express-async-handler');
const { verifyToken } = require('../utils/token');
const User = require('../models/User');

// Require a valid JWT. Attaches req.user.
const protect = asyncHandler(async (req, res, next) => {
  let token;
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    token = header.slice(7);
  }
  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token');
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    res.status(401);
    throw new Error('Not authorized, token invalid');
  }

  const user = await User.findById(decoded.id);
  if (!user || !user.active) {
    res.status(401);
    throw new Error('Not authorized, user not found or inactive');
  }
  req.user = user;
  next();
});

// Require admin role.
function adminOnly(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  res.status(403);
  throw new Error('Admin access required');
}

module.exports = { protect, adminOnly };
