/**
 * Backfill: crea registro en caja (cash_register) PENDIENTE para un pedido por order_number o id
 * Uso: node backend/scripts/backfill_cash_register_for_order_number.js FV-2-15021
 *      node backend/scripts/backfill_cash_register_for_order_number.js 229
 */
const { query, poolEnd } = require('../config/database');

async function pickRegisteredByUserId() {
  const rows = await query(
    `SELECT id, username, role
       FROM users
      WHERE role IN ('cartera','admin') AND active = TRUE
      ORDER BY FIELD(role,'cartera','admin'), id ASC
      LIMIT 1`
  );
  if (!rows.length) throw new Error('No hay usuarios de cartera/admin activos para usar como registered_by');
  return rows[0].id;
}

async function findOrder(key) {
  if (/^\d+$/.test(key)) {
    // numérico: por id o por coincidencia exacta de order_number numérico
    const rows = await query(
      `SELECT id, order_number, total_amount, delivery_method, payment_method
         FROM orders
        WHERE id = ? OR order_number = ?
        ORDER BY id DESC
        LIMIT 1`,
      [Number(key), String(key)]
    );
    return rows[0];
  }
  // texto
  const rows = await query(
    `SELECT id, order_number, total_amount, delivery_method, payment_method
       FROM orders
      WHERE order_number = ? OR order_number LIKE ?
      ORDER BY id DESC
      LIMIT 1`,
    [key, `%${key}%`]
  );
  return rows[0];
}

async function run() {
  const key = process.argv[2];
  if (!key) {
    console.error('Uso: node backend/scripts/backfill_cash_register_for_order_number.js <order_number|id>');
    process.exitCode = 1;
    return;
  }
  try {
    const order = await findOrder(key);
    if (!order) {
      console.log('❌ Pedido no encontrado por clave:', key);
      return;
    }
    console.log('▶️ Pedido encontrado:', order);

    // ¿ya hay registro?
    const existing = await query('SELECT id, status FROM cash_register WHERE order_id = ? LIMIT 1', [order.id]);
    if (existing.length) {
      console.log(`ℹ️ Ya existe cash_register para order_id=${order.id}: id=${existing[0].id}, status=${existing[0].status}`);
      return;
    }

    const amount = Number(order.total_amount || 0);
    const pm = String(order.payment_method || 'efectivo').toLowerCase();
    const dm = 'recoge_bodega'; // normalizamos para Cartera
    const registeredBy = await pickRegisteredByUserId();

    await query(
      `INSERT INTO cash_register (
         order_id, amount, payment_method, delivery_method,
         registered_by, notes, status, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [order.id, amount, pm, dm, registeredBy, `Backfill auto ${order.order_number} (${pm} ${dm})`]
    );

    const [row] = await query(
      `SELECT id, order_id, amount, payment_method, status, created_at
         FROM cash_register WHERE order_id = ? ORDER BY id DESC LIMIT 1`,
      [order.id]
    );

    console.log('✅ cash_register creado:', row);
    console.log('\nSiguiente: Cartera → Entrega de Efectivo (ruta /cashier-collections). Filtros vacíos y pulsar Actualizar.');
  } catch (e) {
    console.error('❌ Error backfill cash_register:', e.message || e);
  } finally {
    await poolEnd();
  }
}

run();
