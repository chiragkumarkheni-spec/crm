const express = require('express');
const {
  listUsers,
  createUser,
  updateUser,
} = require('../controllers/user.controller');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.use(protect, adminOnly);
router.get('/', listUsers);
router.post('/', createUser);
router.patch('/:id', updateUser);

module.exports = router;
