/**
 * Servicio de bloqueo exclusivo para empaque.
 * Implementa operaciones atómicas sobre orders.* para:
 *  - Tomar lock (acquire)
 *  - Renovar lock (heartbeat)
 *  - Pausar/Bloquear y liberar (pause/block)
 *  - Completar y liberar (complete)
 *  - Desbloqueo administrativo (adminUnlock)
 *  - Consultar estado de lock
 */
const { query } = require('../config/database');

const DEFAULT_TTL_MINUTES = 10;

function minutes(n) {
  const m = Number(n);
  return Number.isFinite(m) && m > 0 ? Math.floor(m) : DEFAULT_TTL_MINUTES;
}

/**
 * Intenta adquirir el lock de empaque para un pedido.
 * Retorna { ok: boolean, reason?: string, row?: object }
 */
async function acquireLock(orderId, userId, ttlMinutes = DEFAULT_TTL_MINUTES) {
  const ttl = minutes(ttlMinutes);

  const sql = `
    UPDATE orders
    SET
      packaging_lock_user_id = ?,
      packaging_lock_heartbeat_at = NOW(),
      packaging_lock_expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE),
      packaging_status = CASE WHEN packaging_status = 'requires_review' THEN 'requires_review' ELSE 'in_progress' END,
      packaging_lock_reason = NULL
    WHERE id = ?
      AND (
        packaging_lock_user_id IS NULL
        OR packaging_lock_expires_at < NOW()
        OR packaging_lock_user_id = ?
      )
  `;

  const res = await query(sql, [userId, ttl, orderId, userId]);

  if (res.affectedRows === 1) {
    const [row] = await query(
      'SELECT id, packaging_lock_user_id, packaging_lock_expires_at, packaging_status FROM orders WHERE id = ? LIMIT 1',
      [orderId]
    );
    return { ok: true, row };
  }

  // Lock ocupado: devolver info para cliente
  const [row] = await query(
    `SELECT id, packaging_lock_user_id, packaging_lock_expires_at, packaging_status
     FROM orders WHERE id = ? LIMIT 1`,
    [orderId]
  );
  return { ok: false, reason: 'locked', row };
}

/**
 * Renueva el lock si el usuario es el dueño actual.
 * Retorna { ok: boolean }
 */
async function heartbeat(orderId, userId, ttlMinutes = DEFAULT_TTL_MINUTES) {
  const ttl = minutes(ttlMinutes);
  const sql = `
    UPDATE orders
    SET
      packaging_lock_heartbeat_at = NOW(),
      packaging_lock_expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
    WHERE id = ? AND packaging_lock_user_id = ?
  `;
  const res = await query(sql, [ttl, orderId, userId]);
  return { ok: res.affectedRows === 1 };
}

/**
 * Libera lock y cambia a estado pausado/bloqueado con motivo.
 * newStatus: 'paused' | 'blocked_faltante' | 'blocked_novedad'
 */
async function releaseWithStatus(orderId, userId, newStatus, reason = null) {
  if (!['paused', 'blocked_faltante', 'blocked_novedad'].includes(String(newStatus))) {
    throw new Error('Estado de pausa/bloqueo inválido');
  }

  const sql = `
    UPDATE orders
    SET
      packaging_lock_user_id = NULL,
      packaging_lock_heartbeat_at = NULL,
      packaging_lock_expires_at = NULL,
      packaging_status = ?,
      packaging_lock_reason = ?
    WHERE id = ?
      AND packaging_lock_user_id = ?
  `;
  const res = await query(sql, [newStatus, reason, orderId, userId]);
  return { ok: res.affectedRows === 1 };
}

/**
 * Completa empaque (marca packaging_status=completed) y libera lock.
 * No actualiza orders.status (eso lo hace el flujo de completePackaging actual),
 * pero permite usarlo para liberar lock al completar desde el controlador.
 */
async function completeAndRelease(orderId, userId) {
  const sql = `
    UPDATE orders
    SET
      packaging_lock_user_id = NULL,
      packaging_lock_heartbeat_at = NULL,
      packaging_lock_expires_at = NULL,
      packaging_status = 'completed',
      packaging_lock_reason = NULL
    WHERE id = ?
      AND packaging_lock_user_id = ?
  `;
  const res = await query(sql, [orderId, userId]);
  return { ok: res.affectedRows === 1 };
}

/**
 * Desbloqueo administrativo: limpia lock sin validar dueño.
 */
async function adminUnlock(orderId, adminUserId = null, reason = 'admin_unlock') {
  const sql = `
    UPDATE orders
    SET
      packaging_lock_user_id = NULL,
      packaging_lock_heartbeat_at = NULL,
      packaging_lock_expires_at = NULL,
      packaging_lock_reason = ?
  WHERE id = ?
  `;
  const res = await query(sql, [reason, orderId]);
  return { ok: res.affectedRows === 1 };
}

/**
 * Consulta el estado del lock del pedido.
 */
async function getLockStatus(orderId) {
  const [row] = await query(
    `SELECT id, packaging_lock_user_id, packaging_lock_heartbeat_at, packaging_lock_expires_at, packaging_lock_reason, packaging_status
     FROM orders WHERE id = ? LIMIT 1`,
    [orderId]
  );
  if (!row) return null;

  const isExpired =
    row.packaging_lock_expires_at && new Date(row.packaging_lock_expires_at).getTime() < Date.now();

  return {
    ...row,
    isExpired: !!isExpired
  };
}

/**
 * Verifica si el userId es dueño del lock del pedido.
 */
async function isOwner(orderId, userId) {
  const [row] = await query(
    `SELECT packaging_lock_user_id FROM orders WHERE id = ? LIMIT 1`,
    [orderId]
  );
  if (!row) return false;
  return Number(row.packaging_lock_user_id || 0) === Number(userId || 0);
}

/**
 * Expira (libera) locks vencidos. Puede ser invocado por un cron/tarea.
 * Por defecto deja packaging_status como 'paused' si estaba 'in_progress'.
 */
async function expireStaleLocks(defaultPausedStatus = 'paused') {
  const sql = `
    UPDATE orders
    SET
      packaging_lock_user_id = NULL,
      packaging_lock_heartbeat_at = NULL,
      packaging_lock_expires_at = NULL,
      packaging_status = CASE
        WHEN packaging_status = 'in_progress' THEN ?
        ELSE packaging_status
      END,
      packaging_lock_reason = 'timeout'
    WHERE packaging_lock_expires_at IS NOT NULL
      AND packaging_lock_expires_at < NOW()
  `;
  const res = await query(sql, [defaultPausedStatus]);
  return { released: res.affectedRows || 0 };
}

module.exports = {
  acquireLock,
  heartbeat,
  releaseWithStatus,
  completeAndRelease,
  adminUnlock,
  getLockStatus,
  isOwner,
  expireStaleLocks
};
