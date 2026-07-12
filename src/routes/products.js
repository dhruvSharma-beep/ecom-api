const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../db');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

// GET /api/products?page=1&limit=20&search=&category=&minPrice=&maxPrice=&sort=price_asc
router.get('/', async (req, res, next) => {
  const { page = 1, limit = 20, search = '', category, minPrice, maxPrice, sort = 'created_at_desc' } = req.query;
  const offset = (page - 1) * limit;

  const conditions = ['is_active = true'];
  const values = [];
  let i = 1;

  if (search)   { conditions.push(`(name ILIKE $${i} OR description ILIKE $${i})`); values.push(`%${search}%`); i++; }
  if (category) { conditions.push(`category = $${i++}`); values.push(category); }
  if (minPrice) { conditions.push(`price >= $${i++}`); values.push(Number(minPrice)); }
  if (maxPrice) { conditions.push(`price <= $${i++}`); values.push(Number(maxPrice)); }

  const ORDER = { price_asc: 'price ASC', price_desc: 'price DESC', name_asc: 'name ASC', created_at_desc: 'created_at DESC' };
  const orderBy = ORDER[sort] || 'created_at DESC';

  values.push(limit, offset);

  try {
    const { rows } = await query(
      `SELECT id, name, description, price, stock_qty, category, image_url, created_at
       FROM products WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderBy} LIMIT $${i++} OFFSET $${i++}`,
      values
    );
    const { rows: [{ count }] } = await query(
      `SELECT COUNT(*) FROM products WHERE ${conditions.join(' AND ')}`,
      values.slice(0, -2)
    );
    res.json({ products: rows, total: Number(count), page: Number(page) });
  } catch (err) { next(err); }
});

// GET /api/products/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM products WHERE id = $1 AND is_active = true', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/products — manager/admin
router.post('/',
  authenticate,
  body('name').trim().notEmpty(),
  body('price').isFloat({ min: 0 }),
  body('stockQty').isInt({ min: 0 }),
  async (req, res, next) => {
    if (!['admin', 'manager'].includes(req.user.role))
      return res.status(403).json({ error: 'Manager or admin required' });
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, description, price, stockQty, category, imageUrl } = req.body;
    try {
      const { rows } = await query(
        'INSERT INTO products (name, description, price, stock_qty, category, image_url) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
        [name, description, price, stockQty, category, imageUrl]
      );
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

// PUT /api/products/:id
router.put('/:id', authenticate, async (req, res, next) => {
  if (!['admin', 'manager'].includes(req.user.role))
    return res.status(403).json({ error: 'Manager or admin required' });

  const allowed = ['name', 'description', 'price', 'stock_qty', 'category', 'image_url', 'is_active'];
  const updates = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

  const values = updates.map(k => req.body[k]);
  values.push(req.params.id);

  try {
    const { rows } = await query(
      `UPDATE products SET ${updates.map((k, i) => `${k} = $${i + 1}`).join(', ')}, updated_at = NOW()
       WHERE id = $${updates.length + 1} RETURNING *`,
      values
    );
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/products/:id
router.delete('/:id', authenticate, async (req, res, next) => {
  if (!['admin', 'manager'].includes(req.user.role))
    return res.status(403).json({ error: 'Manager or admin required' });
  try {
    await query('UPDATE products SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
