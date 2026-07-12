const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { query } = require('../db');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

const requireAdmin = (req, res, next) =>
  req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admin access required' });

// GET /api/users — admin only
router.get('/', authenticate, requireAdmin, async (req, res, next) => {
  const { page = 1, limit = 20, search = '' } = req.query;
  const offset = (page - 1) * limit;
  try {
    const { rows } = await query(
      `SELECT id, email, name, role, is_active, created_at
       FROM users
       WHERE (name ILIKE $1 OR email ILIKE $1)
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [`%${search}%`, limit, offset]
    );
    const { rows: [{ count }] } = await query('SELECT COUNT(*) FROM users WHERE name ILIKE $1 OR email ILIKE $1', [`%${search}%`]);
    res.json({ users: rows, total: Number(count), page: Number(page) });
  } catch (err) { next(err); }
});

// GET /api/users/:id
router.get('/:id', authenticate, async (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.id !== req.params.id)
    return res.status(403).json({ error: 'Forbidden' });
  try {
    const { rows } = await query('SELECT id, email, name, role, is_active, created_at FROM users WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/users/:id
router.put('/:id',
  authenticate,
  body('name').optional().trim().notEmpty(),
  body('email').optional().isEmail().normalizeEmail(),
  async (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.id !== req.params.id)
      return res.status(403).json({ error: 'Forbidden' });

    const { name, email, password } = req.body;
    const updates = [];
    const values = [];
    let i = 1;

    if (name)     { updates.push(`name = $${i++}`);     values.push(name); }
    if (email)    { updates.push(`email = $${i++}`);    values.push(email); }
    if (password) { updates.push(`password = $${i++}`); values.push(await bcrypt.hash(password, 12)); }

    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    values.push(req.params.id);

    try {
      const { rows } = await query(
        `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING id, email, name, role`,
        values
      );
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

// DELETE /api/users/:id — admin only
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    await query('UPDATE users SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
