#!/usr/bin/env node
/**
 * Muestra el estado del lock de empaque para un pedido.
 *
 * Uso:
 *  node backend/scripts/show_packaging_lock_status.js 15213
 *  node backend/scripts/show_packaging_lock_status.js FV-2-15213
 */
const { query, poolEnd } = require('../config/database');

async function resolveOrder(key) {
  if (!key) return null;

  // Buscar por id numérico o por order_number (exacto o LIKE)
  if (/^\d+$/.test(key)) {
    const rows = await query(
      `SELECT id, order_number, status,
              packaging_status,
              packaging_lock_user_id, packaging_lock_heartbeat_at,
              packaging_lock_expires_at, packaging_lock_reason,
              updated_at, created_at
         FROM orders
        WHERE id = ? OR order_number = ? OR order_number LIKE ?
        ORDER BY id DESC
        LIMIT 1`,
      [Number(key), String(key), '%' + key + '%']
    );
    return rows[0] || null;
  } else {
    const rows = await query(
      `SELECT id, order_number, status,
              packaging_status,
              packaging_lock_user_id, packaging_lock_heartbeat_at,
              packaging_lock_expires_at, packaging_lock_reason,
              updated_at, created_at
         FROM orders
        WHERE order_number = ? OR order_number LIKE ?
        ORDER BY id DESC
        LIMIT 1`,
      [key, '%' + key + '%']
    );
    return rows[0] || null;
  }
}

async function resolveUser(userId) {
  if (!userId) return null;
  const rows = await query(
    `SELECT id, username, full_name, role
       FROM users
      WHERE id = ?
      LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

function fmt(dt) {
  if (!dt) return null;
  try {
    return new Date(dt).toISOString();
  } catch {
    return String(dt);
  }
}

async function run() {
  const key = process.argv[2];
  if (!key) {
    console.error('Uso: node backend/scripts/show_packaging_lock_status.js <order_id u order_number>');
    process.exitCode = 1;
    return;
  }

  try {
    const order = await resolveOrder(key);
    if (!order) {
      console.log('No se encontró pedido con clave:', key);
      return;
    }

    const now = Date.now();
    const expiresAt = order.packaging_lock_expires_at ? new Date(order.packaging_lock_expires_at).getTime() : null;
    const isExpired = expiresAt ? (expiresAt < now) : false;
    const ttlMs = expiresAt ? (expiresAt - now) : null;

    const lockedUser = await resolveUser(order.packaging_lock_user_id);

    const result = {
      order: {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        packaging_status: order.packaging_status,
        updated_at: fmt(order.updated_at),
        created_at: fmt(order.created_at)
      },
      lock: {
        packaging_lock_user_id: order.packaging_lock_user_id,
        packaging_lock_username: lockedUser?.username || null,
        packaging_lock_full_name: lockedUser?.full_name || null,
        packaging_lock_role: lockedUser?.role || null,
        packaging_lock_heartbeat_at: fmt(order.packaging_lock_heartbeat_at),
        packaging_lock_expires_at: fmt(order.packaging_lock_expires_at),
        packaging_lock_reason: order.packaging_lock_reason || null,
        isExpired,
        ttl_seconds: ttlMs != null ? Math.floor(ttlMs / 1000) : null
      }
    };

    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Error:', e?.sqlMessage || e?.message || e);
    process.exitCode = 1;
  } finally {
    await poolEnd().catch(() => {});
  }
}

run();
