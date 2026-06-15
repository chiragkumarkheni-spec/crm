const asyncHandler = require('express-async-handler');
const User = require('../models/User');

// GET /api/users  (admin) — list active users, or the Recycle Bin (?deleted=true)
const listUsers = asyncHandler(async (req, res) => {
  const wantDeleted = req.query.deleted === 'true';
  const filter = wantDeleted ? { deleted: true } : { deleted: { $ne: true } };
  const users = await User.find(filter).sort(
    wantDeleted ? { deletedAt: -1 } : { createdAt: -1 }
  );
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

// DELETE /api/users/:id  (admin) — soft delete: move the user to the Recycle Bin.
// The record is kept in the database (never hard-deleted); it is just hidden and
// deactivated so the person can no longer log in. It can be restored later.
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  if (user._id.toString() === req.user._id.toString()) {
    res.status(400);
    throw new Error('You cannot delete your own account');
  }
  if (user.role === 'admin') {
    res.status(400);
    throw new Error('Admin accounts cannot be deleted');
  }
  user.deleted = true;
  user.deletedAt = new Date();
  user.active = false; // a deleted user cannot log in
  await user.save();
  res.json(user);
});

// POST /api/users/:id/restore  (admin) — bring a user back from the Recycle Bin.
const restoreUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  user.deleted = false;
  user.deletedAt = undefined;
  user.active = true;
  await user.save();
  res.json(user);
});

module.exports = { listUsers, createUser, updateUser, deleteUser, restoreUser };
