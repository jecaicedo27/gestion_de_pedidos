/**
 * loyaltyService: Programa de puntos (Fase 3)
 * Tablas: loyalty_points (saldo y nivel), loyalty_movements (histórico)
 * Niveles simples por saldo: bronze < 1000, silver < 5000, gold < 20000, platinum ≥ 20000
 */
const { query } = require('../../config/database');

function levelFromBalance(balance) {
  const b = Number(balance || 0);
  if (b >= 20000) return 'platinum';
  if (b >= 5000) return 'gold';
  if (b >= 1000) return 'silver';
  return 'bronze';
}

async function ensureRow(customerId) {
  const rows = await query('SELECT customer_id, balance, level FROM loyalty_points WHERE customer_id = ? LIMIT 1', [customerId]);
  if (rows.length) return rows[0];
  await query('INSERT INTO loyalty_points (customer_id, balance, level, created_at) VALUES (?, 0, "bronze", NOW())', [customerId]);
  return { customer_id: customerId, balance: 0, level: 'bronze' };
}

async function getBalance(customerId, opts = {}) {
  const row = await ensureRow(customerId);
  let movements = [];
  if (opts.includeMovements) {
    movements = await query(
      'SELECT id, points, reason, order_id, meta, created_at FROM loyalty_movements WHERE customer_id = ? ORDER BY id DESC LIMIT ?',
      [customerId, Number(opts.limit || 20)]
    );
  }
  return {
    customerId,
    balance: Number(row.balance || 0),
    level: row.level || levelFromBalance(row.balance || 0),
    movements
  };
}

async function addMovement({ customerId, points, reason, orderId = null, meta = null }) {
  await query(
    `INSERT INTO loyalty_movements (customer_id, points, reason, order_id, meta, created_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [customerId, Number(points || 0), String(reason || 'adjustment'), orderId, meta ? JSON.stringify(meta) : null]
  );
}

async function updateBalanceAndLevel(customerId, delta) {
  // actualizar saldo
  await query('UPDATE loyalty_points SET balance = balance + ?, updated_at = NOW() WHERE customer_id = ?', [delta, customerId]);
  // leer saldo
  const [row] = await query('SELECT balance FROM loyalty_points WHERE customer_id = ? LIMIT 1', [customerId]);
  const newBal = Number(row?.balance || 0);
  const newLevel = levelFromBalance(newBal);
  await query('UPDATE loyalty_points SET level = ?, updated_at = NOW() WHERE customer_id = ?', [newLevel, customerId]);
  return { balance: newBal, level: newLevel };
}

// Gana puntos (purchase, feedback, referral, adjustment)
async function earnPoints({ customerId, points, reason = 'purchase', orderId = null, meta = null }) {
  if (!customerId || !points || Number(points) === 0) throw new Error('customerId y points son requeridos');
  await ensureRow(customerId);
  await addMovement({ customerId, points: Math.abs(Number(points)), reason, orderId, meta });
  const res = await updateBalanceAndLevel(customerId, Math.abs(Number(points)));
  return { customerId, ...res };
}

// Redimir puntos (spend)
async function spendPoints({ customerId, points, reason = 'adjustment', orderId = null, meta = null }) {
  const pts = Math.abs(Number(points || 0));
  if (!customerId || !pts) throw new Error('customerId y points son requeridos');
  await ensureRow(customerId);
  // validar saldo
  const bal = await getBalance(customerId);
  if (bal.balance < pts) {
    throw new Error('Saldo de puntos insuficiente');
  }
  await addMovement({ customerId, points: -pts, reason, orderId, meta });
  const res = await updateBalanceAndLevel(customerId, -pts);
  return { customerId, ...res };
}

module.exports = {
  getBalance,
  earnPoints,
  spendPoints
};
