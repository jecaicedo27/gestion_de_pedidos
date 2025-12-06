/**
 * referralsService: Gestión de referidos (Fase 3)
 * Tablas: referrals
 * Estados: generated -> registered -> first_purchase -> rewarded (o cancelled)
 * Integra con loyaltyService para recompensas en puntos.
 */
const { query } = require('../../config/database');
const loyaltyService = require('./loyaltyService');

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

function randomCode(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function codeExists(code) {
  const rows = await query('SELECT id FROM referrals WHERE code = ? LIMIT 1', [code]);
  return rows.length > 0;
}

/**
 * Genera un código único para referrer_customer_id en estado 'generated'
 */
async function generateCode(referrerCustomerId, { desiredLength = 8 } = {}) {
  if (!referrerCustomerId) throw new Error('referrerCustomerId es requerido');
  let attempts = 0;
  let code;
  do {
    code = randomCode(desiredLength);
    attempts++;
    if (attempts > 20) throw new Error('No fue posible generar código único de referido');
  } while (await codeExists(code));

  await query(
    `INSERT INTO referrals (referrer_customer_id, referred_customer_id, code, state, reward_points, created_at)
     VALUES (?, NULL, ?, 'generated', 0, NOW())`,
    [referrerCustomerId, code]
  );

  return { referrerCustomerId, code, state: 'generated' };
}

/**
 * Lista los referidos de un cliente (como referrer), filtrando opcionalmente por estado
 */
async function listByReferrer(referrerCustomerId, { state = null } = {}) {
  if (!referrerCustomerId) throw new Error('referrerCustomerId es requerido');
  let sql = `SELECT id, referrer_customer_id, referred_customer_id, code, state, reward_points, created_at, updated_at
             FROM referrals WHERE referrer_customer_id = ?`;
  const params = [referrerCustomerId];
  if (state) {
    sql += ' AND state = ?';
    params.push(String(state));
  }
  sql += ' ORDER BY id DESC';
  const rows = await query(sql, params);
  return rows;
}

/**
 * Registrar un referido usando código. Pasa de 'generated' a 'registered'
 */
async function registerReferral({ code, referredCustomerId }) {
  const c = normalizeCode(code);
  if (!c || !referredCustomerId) throw new Error('code y referredCustomerId son requeridos');

  const rows = await query(
    `SELECT id, state, referrer_customer_id, referred_customer_id FROM referrals WHERE code = ? LIMIT 1`,
    [c]
  );
  if (!rows.length) throw new Error('Código de referido inválido');
  const r = rows[0];

  if (r.state !== 'generated') throw new Error('El código ya fue utilizado o no es válido para registro');
  if (r.referrer_customer_id === referredCustomerId) throw new Error('Un cliente no puede referirse a sí mismo');

  await query(
    `UPDATE referrals SET referred_customer_id = ?, state = 'registered', updated_at = NOW() WHERE id = ?`,
    [referredCustomerId, r.id]
  );

  return { id: r.id, code: c, referrerCustomerId: r.referrer_customer_id, referredCustomerId, state: 'registered' };
}

/**
 * Marca first_purchase para un referido ya registrado.
 * Puede otorgar puntos base a ambas partes.
 */
async function markFirstPurchase({ referredCustomerId, pointsReferrer = 500, pointsReferred = 200, orderId = null }) {
  if (!referredCustomerId) throw new Error('referredCustomerId es requerido');

  // Buscar el referral por referred
  const rows = await query(
    `SELECT id, state, referrer_customer_id, referred_customer_id, reward_points
       FROM referrals
      WHERE referred_customer_id = ?
      ORDER BY id DESC
      LIMIT 1`,
    [referredCustomerId]
  );
  if (!rows.length) throw new Error('No hay referido registrado para este cliente');
  const r = rows[0];

  if (r.state !== 'registered' && r.state !== 'first_purchase') {
    throw new Error('El estado actual no permite marcar primera compra');
  }

  // Actualizar estado a first_purchase
  await query(`UPDATE referrals SET state = 'first_purchase', updated_at = NOW() WHERE id = ?`, [r.id]);

  // Recompensas de puntos
  const rewardMeta = { source: 'referral_first_purchase', referral_id: r.id, order_id: orderId };
  if (pointsReferrer > 0) {
    await loyaltyService.earnPoints({
      customerId: r.referrer_customer_id,
      points: pointsReferrer,
      reason: 'referral',
      orderId,
      meta: rewardMeta
    });
  }
  if (pointsReferred > 0) {
    await loyaltyService.earnPoints({
      customerId: r.referred_customer_id,
      points: pointsReferred,
      reason: 'referral',
      orderId,
      meta: rewardMeta
    });
  }

  await query(`UPDATE referrals SET reward_points = reward_points + ? WHERE id = ?`, [pointsReferrer + pointsReferred, r.id]);

  return {
    id: r.id,
    state: 'first_purchase',
    referrerCustomerId: r.referrer_customer_id,
    referredCustomerId: r.referred_customer_id,
    rewarded: { referrer: pointsReferrer, referred: pointsReferred }
  };
}

/**
 * Marca como rewarded explícitamente (por campañas adicionales)
 */
async function reward({ referrerCustomerId, referredCustomerId, pointsReferrer = 0, pointsReferred = 0, orderId = null }) {
  if (!referrerCustomerId || !referredCustomerId) throw new Error('referrerCustomerId y referredCustomerId son requeridos');

  const rows = await query(
    `SELECT id, state FROM referrals WHERE referrer_customer_id = ? AND referred_customer_id = ? ORDER BY id DESC LIMIT 1`,
    [referrerCustomerId, referredCustomerId]
  );
  if (!rows.length) throw new Error('Relación de referido no encontrada');
  const r = rows[0];

  // Otorgar puntos extra si aplica
  const rewardMeta = { source: 'referral_reward', referral_id: r.id, order_id: orderId };
  if (pointsReferrer > 0) {
    await loyaltyService.earnPoints({ customerId: referrerCustomerId, points: pointsReferrer, reason: 'referral', orderId, meta: rewardMeta });
  }
  if (pointsReferred > 0) {
    await loyaltyService.earnPoints({ customerId: referredCustomerId, points: pointsReferred, reason: 'referral', orderId, meta: rewardMeta });
  }

  await query(
    `UPDATE referrals SET state = 'rewarded', reward_points = reward_points + ?, updated_at = NOW() WHERE id = ?`,
    [pointsReferrer + pointsReferred, r.id]
  );

  return { id: r.id, state: 'rewarded', referrerCustomerId, referredCustomerId, rewarded: { referrer: pointsReferrer, referred: pointsReferred } };
}

module.exports = {
  generateCode,
  listByReferrer,
  registerReferral,
  markFirstPurchase,
  reward
};
