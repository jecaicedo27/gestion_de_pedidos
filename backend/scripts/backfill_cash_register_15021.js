/**
 * Backfill: crea registro en caja (cash_register) PENDIENTE para pedido FV-2-15021 (id 38)
 * Uso: node backend/scripts/backfill_cash_register_15021.js
 */
const { query, poolEnd } = require('../config/database');

async function pickRegisteredByUserId() {
  // Preferir un usuario de cartera; si no, logística; si no, admin
  const rows = await query(
    `SELECT id, username, role
       FROM users
      WHERE role IN ('cartera','logistica','admin') AND active = TRUE
      ORDER BY FIELD(role,'cartera','logistica','admin'), id ASC
      LIMIT 1`
  );
  if (!rows.length) throw new Error('No hay usuarios activos para usar como registered_by');
  return rows[0].id;
}

async function run() {
  try {
    // 1) Obtener pedido
    const orders = await query(
      `SELECT id, order_number, total_amount, delivery_method, payment_method
         FROM orders
        WHERE id = ? OR order_number = ?
        LIMIT 1`,
      [38, 'FV-2-15021']
    );
    if (!orders.length) {
      console.log('❌ Pedido 15021 no encontrado');
      return;
    }
    const o = orders[0];

    // 2) Validar si ya existe registro en caja
    const existing = await query(`SELECT id, status FROM cash_register WHERE order_id = ? LIMIT 1`, [o.id]);
    if (existing.length) {
      console.log(`ℹ️ Ya existe cash_register para order_id=${o.id} -> id=${existing[0].id}, status=${existing[0].status}`);
      return;
    }

    // 3) Preparar datos
    const amount = Number(o.total_amount || 0);
    const pm = String(o.payment_method || 'efectivo').toLowerCase();
    const dm = String(o.delivery_method || 'recoge_bodega').toLowerCase();
    const registeredBy = await pickRegisteredByUserId();
    const notes = 'Backfill auto FV-2-15021 (efectivo recoge bodega)';

    // 4) Insertar PENDIENTE
    await query(
      `INSERT INTO cash_register (
         order_id, amount, payment_method, delivery_method,
         registered_by, notes, status, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [o.id, amount, pm, dm, registeredBy, notes]
    );

    const [row] = await query(
      `SELECT id, order_id, amount, payment_method, status, created_at
         FROM cash_register WHERE order_id = ? ORDER BY id DESC LIMIT 1`,
      [o.id]
    );
    console.log('✅ cash_register creado:', row);
    console.log('\nSiguiente: abre Cartera > Pendientes. Deberías verlo como fuente Bodega (status pending).');
  } catch (e) {
    console.error('❌ Error backfill cash_register 15021:', e.message || e);
  } finally {
    await poolEnd();
  }
}

run();
