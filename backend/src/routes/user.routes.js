const express = require('express');
const {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  restoreUser,
} = require('../controllers/user.controller');
const { protect, adminOnly } = require('../middleware/auth');
const { validate, z } = require('../middleware/validate');

const router = express.Router();

const createUserSchema = z
  .object({
    name: z.string().min(1, 'Name daalo'),
    email: z.string().email('Sahi email daalo'),
    password: z.string().min(1, 'Password daalo'),
    role: z.enum(['admin', 'employee']).optional(),
  })
  .passthrough();

router.use(protect, adminOnly);
router.get('/', listUsers);
router.post('/', validate(createUserSchema), createUser);
router.patch('/:id', updateUser);
router.delete('/:id', deleteUser);
router.post('/:id/restore', restoreUser);

module.exports = router;
