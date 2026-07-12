const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, pool } = require('../db');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

const STATUS_FLOW = { pending: ['confirmed', 'cancelled'], confirmed: ['shipped', 'cancelled'], shipped: ['delivered'], delivered: [], cancelled: [] };

// GET /api/orders
router.get('/', authenticate, async (req, res, next) => {
  const { page = 1, limit = 20, status } = req.query;
  const isAdmin = ['admin', 'manager'].includes(req.user.role);

  const conditions = isAdmin ? [] : ['o.user_id = $1'];
  const values = isAdmin ? [] : [req.user.id];
  let i = values.length + 1;

  if (status) { conditions.push(`o.status = $${i++}`); values.push(status); }
  values.push(limit, (page - 1) * limit);

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  try {
    const { rows } = await query(
      `SELECT o.*, u.name as customer_name, u.email as customer_email,
              COUNT(oi.id)::int as item_count, SUM(oi.quantity * oi.unit_price) as total_amount
       FROM orders o
       JOIN users u ON u.id = o.user_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       ${where}
       GROUP BY o.id, u.name, u.email
       ORDER BY o.created_at DESC LIMIT $${i++} OFFSET $${i++}`,
      values
    );
    res.json({ orders: rows, page: Number(page) });
  } catch (err) { next(err); }
});

// GET /api/orders/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { rows: [order] } = await query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.user_id !== req.user.id && !['admin', 'manager'].includes(req.user.role))
      return res.status(403).json({ error: 'Forbidden' });

    const { rows: items } = await query(
      'SELECT oi.*, p.name, p.image_url FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1',
      [req.params.id]
    );
    res.json({ ...order, items });
  } catch (err) { next(err); }
});

// POST /api/orders
router.post('/',
  authenticate,
  body('items').isArray({ min: 1 }),
  body('shippingAddress').notEmpty(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { items, shippingAddress, notes } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: [order] } = await client.query(
        'INSERT INTO orders (user_id, shipping_address, notes, status) VALUES ($1, $2, $3, $4) RETURNING *',
        [req.user.id, shippingAddress, notes, 'pending']
      );

      let total = 0;
      for (const item of items) {
        const { rows: [product] } = await client.query(
          'SELECT id, price, stock_qty FROM products WHERE id = $1 FOR UPDATE',
          [item.productId]
        );
        if (!product) throw Object.assign(new Error(`Product ${item.productId} not found`), { status: 404 });
        if (product.stock_qty < item.quantity) throw Object.assign(new Error(`Insufficient stock for product ${item.productId}`), { status: 400 });

        await client.query(
          'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1,$2,$3,$4)',
          [order.id, item.productId, item.quantity, product.price]
        );
        await client.query('UPDATE products SET stock_qty = stock_qty - $1 WHERE id = $2', [item.quantity, item.productId]);
        total += product.price * item.quantity;
      }

      await client.query('UPDATE orders SET total_amount = $1 WHERE id = $2', [total, order.id]);
      await client.query('COMMIT');

      res.status(201).json({ ...order, total_amount: total });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// PUT /api/orders/:id/status
router.put('/:id/status', authenticate, async (req, res, next) => {
  const { status } = req.body;
  if (!['admin', 'manager'].includes(req.user.role))
    return res.status(403).json({ error: 'Manager or admin required' });

  try {
    const { rows: [order] } = await query('SELECT status FROM orders WHERE id = $1', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!STATUS_FLOW[order.status]?.includes(status))
      return res.status(400).json({ error: `Cannot move order from ${order.status} to ${status}` });

    const { rows } = await query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
