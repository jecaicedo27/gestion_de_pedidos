/**
 * Fuerza packaging_status='requires_review' para un pedido si tiene ítems activos sin verificar.
 * Uso:
 *   node backend/scripts/force_requires_review.js 158
 *   node backend/scripts/force_requires_review.js FV-2-15319
 */
const { query } = require('../config/database');

async function resolveOrderId(arg) {
  if (!arg) return null;
  if (/^\d+$/.test(String(arg))) {
    const rows = await query('SELECT id, order_number FROM orders WHERE id = ? LIMIT 1', [Number(arg)]);
    return rows[0] || null;
  } else {
    const rows = await query('SELECT id, order_number FROM orders WHERE order_number = ? LIMIT 1', [String(arg)]);
    return rows[0] || null;
  }
}

async function main() {
  try {
    const arg = process.argv[2];
    if (!arg) {
      console.log('❌ Debes indicar orderId o número de pedido');
      process.exit(1);
    }
    const order = await resolveOrderId(arg);
    if (!order) {
      console.log('❌ Pedido no encontrado:', arg);
      process.exit(1);
    }

    // Contar ítems activos y verificados
    const rows = await query(`
      SELECT 
        COUNT(oi.id) AS total_items,
        COALESCE(SUM(CASE WHEN piv.is_verified = 1 THEN 1 ELSE 0 END), 0) AS completed_items
      FROM order_items oi
      LEFT JOIN packaging_item_verifications piv ON piv.order_id = oi.order_id AND piv.item_id = oi.id
      WHERE oi.order_id = ? AND (oi.status IS NULL OR oi.status <> 'replaced')
    `, [order.id]);

    const total = Number(rows[0]?.total_items || 0);
    const done = Number(rows[0]?.completed_items || 0);
    const pending = Math.max(total - done, 0);

    console.log(`📦 Pedido ${order.order_number} (id=${order.id}) → activos ${total}, verificados ${done}, pendientes ${pending}`);

    if (total === 0) {
      console.log('ℹ️ No hay ítems activos. No se cambia packaging_status.');
      process.exit(0);
    }

    // Forzar requires_review si hay pendientes
    if (pending > 0) {
      const res = await query(
        `UPDATE orders SET packaging_status = 'requires_review', updated_at = NOW() WHERE id = ?`,
        [order.id]
      );
      console.log(`✅ packaging_status='requires_review' aplicado. affectedRows=${res.affectedRows}`);
    } else {
      console.log('ℹ️ Todos los ítems activos están verificados. Se mantiene el estado actual.');
    }

    // Mostrar snapshot final
    const snap = await query(
      `SELECT id, order_number, status, packaging_status, updated_at FROM orders WHERE id = ? LIMIT 1`,
      [order.id]
    );
    console.log('🔎 Estado actual:', snap[0]);
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e?.message || e);
    process.exit(1);
  }
}

main();
