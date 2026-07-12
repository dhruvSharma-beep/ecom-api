const express = require('express');
const { getAlerts, resolveAlert, runAlertScan } = require('../services/inventoryAlertService');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

// GET /api/alerts
router.get('/', authenticate, async (req, res, next) => {
  try {
    const alerts = await getAlerts(req.user.id, req.query);
    res.json({ alerts });
  } catch (err) { next(err); }
});

// POST /api/alerts/scan — trigger a fresh inventory scan
router.post('/scan', authenticate, async (req, res, next) => {
  if (!['admin', 'manager'].includes(req.user.role))
    return res.status(403).json({ error: 'Manager or admin required' });
  try {
    const result = await runAlertScan(req.user.id);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

// PUT /api/alerts/:id/resolve
router.put('/:id/resolve', authenticate, async (req, res, next) => {
  try {
    const alert = await resolveAlert(req.params.id, req.user.id);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json(alert);
  } catch (err) { next(err); }
});

module.exports = router;
