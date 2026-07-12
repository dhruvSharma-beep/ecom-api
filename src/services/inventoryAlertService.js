const { query } = require('../db');

const DEFAULT_THRESHOLD = 10;

async function getProductsBelowThreshold() {
  const { rows } = await query(
    'SELECT id, name, stock_qty, low_stock_threshold FROM products WHERE stock_qty <= COALESCE(low_stock_threshold, $1) AND is_active = true ORDER BY stock_qty ASC',
    [DEFAULT_THRESHOLD]
  );
  return rows;
}

async function getAlerts(userId, { status, severity, page = 1, limit = 20 }) {
  const conditions = ['a.user_id = $1'];
  const values = [userId];
  let i = 2;

  if (status)   { conditions.push(`a.status = $${i++}`);   values.push(status); }
  if (severity) { conditions.push(`a.severity = $${i++}`); values.push(severity); }
  values.push(limit, (page - 1) * limit);

  const { rows } = await query(
    `SELECT a.*, p.name as product_name, p.stock_qty
     FROM inventory_alerts a
     JOIN products p ON p.id = a.product_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY a.created_at DESC LIMIT $${i++} OFFSET $${i++}`,
    values
  );
  return rows;
}

async function createAlert(userId, productId, currentStock, threshold) {
  const severity = currentStock === 0 ? 'critical' : currentStock <= 5 ? 'high' : 'medium';
  const { rows: [alert] } = await query(
    'INSERT INTO inventory_alerts (user_id, product_id, current_stock, threshold, severity, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [userId, productId, currentStock, threshold, severity, 'open']
  );
  return alert;
}

async function resolveAlert(alertId, resolvedBy) {
  const { rows: [alert] } = await query(
    'UPDATE inventory_alerts SET status = $1, resolved_by = $2, resolved_at = NOW() WHERE id = $3 RETURNING *',
    ['resolved', resolvedBy, alertId]
  );
  return alert;
}

async function runAlertScan(userId) {
  const products = await getProductsBelowThreshold();
  const newAlerts = [];

  for (const product of products) {
    const existing = await query(
      'SELECT id FROM inventory_alerts WHERE product_id = $1 AND status = $2',
      [product.id, 'open']
    );
    if (existing.rows.length) continue;

    const alert = await createAlert(userId, product.id, product.stock_qty, product.low_stock_threshold || DEFAULT_THRESHOLD);
    newAlerts.push(alert);
  }

  return { scanned: products.length, created: newAlerts.length, alerts: newAlerts };
}

module.exports = { getAlerts, createAlert, resolveAlert, runAlertScan, getProductsBelowThreshold };
