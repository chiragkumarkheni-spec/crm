const express = require('express');
const {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  restoreUser,
} = require('../controllers/user.controller');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.use(protect, adminOnly);
router.get('/', listUsers);
router.post('/', createUser);
router.patch('/:id', updateUser);
router.delete('/:id', deleteUser);
router.post('/:id/restore', restoreUser);

module.exports = router;
