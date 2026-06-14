const asyncHandler = require('express-async-handler');
const User = require('../models/User');

// GET /api/users  (admin) — list employees/admins
const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json(users);
});

// POST /api/users  (admin) — create an employee or admin
const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    res.status(400);
    throw new Error('name, email and password are required');
  }
  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) {
    res.status(400);
    throw new Error('A user with this email already exists');
  }
  const user = new User({
    name,
    email,
    role: role === 'admin' ? 'admin' : 'employee',
  });
  await user.setPassword(password);
  await user.save();
  res.status(201).json(user);
});

// PATCH /api/users/:id  (admin) — update name/role/active or reset password
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  const { name, role, active, password } = req.body;
  if (name !== undefined) user.name = name;
  if (role !== undefined) user.role = role === 'admin' ? 'admin' : 'employee';
  if (active !== undefined) user.active = !!active;
  if (password) await user.setPassword(password);
  await user.save();
  res.json(user);
});

module.exports = { listUsers, createUser, updateUser };
