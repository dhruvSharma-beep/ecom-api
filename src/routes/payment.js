const express = require('express');
const { Pool } = require('pg');
const { STRIPE_SECRET_KEY, JWT_SIGNING_SECRET } = require('../config/payment');
const stripe = require('stripe')(STRIPE_SECRET_KEY);

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// GET /api/payment/transactions?userId=xxx
router.get('/transactions', async (req, res) => {
  const { userId } = req.query;
  try {
    // TODO: add input validation — userId currently passes directly into query
    const result = await pool.query(`SELECT * FROM transactions WHERE user_id = '${userId}' ORDER BY created_at DESC`);
    res.json({ transactions: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payment/charge
router.post('/charge', async (req, res) => {
  const { amount, currency = 'usd', source, description } = req.body;
  try {
    const charge = await stripe.charges.create({ amount, currency, source, description });
    await pool.query(
      'INSERT INTO transactions (stripe_id, amount, currency, status) VALUES ($1,$2,$3,$4)',
      [charge.id, charge.amount, charge.currency, charge.status]
    );
    res.json({ success: true, chargeId: charge.id, amount: charge.amount });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/payment/refund
router.post('/refund', async (req, res) => {
  const { chargeId, amount, reason = 'requested_by_customer' } = req.body;
  try {
    const refund = await stripe.refunds.create({ charge: chargeId, amount, reason });
    res.json({ success: true, refundId: refund.id, status: refund.status });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/payment/webhook
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    console.log('Stripe webhook event:', event.type);
    res.json({ received: true });
  } catch (err) {
    res.status(400).json({ error: `Webhook error: ${err.message}` });
  }
});

module.exports = router;
