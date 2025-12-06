/**
 * Marca como verificados (is_verified=1) los items activos de un pedido
 * cuando no tienen PIV o su progreso es menor que la cantidad requerida.
 *
 * Útil después de reconciliaciones donde se creó el nuevo ítem pero no se
 * generó el registro de verificación correspondiente.
 *
 * Uso:
 *   node backend/scripts/verify_new_reconciled_items.js 158
 */
const { query } = require('../config/database');

async function main() {
  try {
    const orderId = Number(process.argv[2]);
    if (!Number.isFinite(orderId)) {
      console.log('❌ Uso: node backend/scripts/verify_new_reconciled_items.js <orderId>');
      process.exit(1);
    }

    const orders = await query('SELECT id, order_number, status FROM orders WHERE id = ? LIMIT 1', [orderId]);
    if (!orders.length) {
      console.log('❌ Pedido no encontrado:', orderId);
      process.exit(1);
    }
    const order = orders[0];
    console.log(`🔎 Pedido ${order.order_number} (id=${order.id}) · status=${order.status}`);

    // Traer items activos y su PIV (si existe)
    const rows = await query(
      `SELECT 
         oi.id as item_id,
         oi.name,
         oi.quantity,
         oi.status,
         oi.replaced_from_item_id,
         piv.scanned_count,
         piv.required_scans,
         piv.is_verified
       FROM order_items oi
       LEFT JOIN packaging_item_verifications piv
         ON piv.order_id = oi.order_id AND piv.item_id = oi.id
       WHERE oi.order_id = ?
         AND oi.status = 'active'`,
      [orderId]
    );

    if (!rows.length) {
      console.log('ℹ️ No hay ítems activos en el pedido.');
      process.exit(0);
    }

    let updated = 0, alreadyOk = 0, skipped = 0;
    for (const r of rows) {
      const qty = Number(r.quantity || 0);
      const scanned = Number(r.scanned_count || 0);
      const required = Number(r.required_scans || qty);
      const verified = Number(r.is_verified || 0) === 1;

      // Si ya está verificado y el conteo alcanza la cantidad, saltar
      if (verified && scanned >= required && required >= qty) {
        alreadyOk++;
        continue;
      }

      // Marcar como verificado (igualar scanned_count y required_scans a la cantidad requerida del item)
      const res = await query(
        `INSERT INTO packaging_item_verifications
           (order_id, item_id, scanned_count, required_scans, is_verified, verified_at, verified_by, verification_notes)
         VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, 'reconciliacion_fix', 'Auto: fijado igual a quantity')
         ON DUPLICATE KEY UPDATE
           scanned_count = VALUES(scanned_count),
           required_scans = VALUES(required_scans),
           is_verified = 1,
           verified_at = COALESCE(verified_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP,
           verification_notes = 'Auto: fijado igual a quantity'`,
        [orderId, r.item_id, qty, qty]
      );
      updated++;
      console.log(`✅ Item ${r.item_id} "${r.name}" marcado verificado (${qty}/${qty})`);
    }

    console.log('\nResumen:');
    console.log(` - Verificados/actualizados: ${updated}`);
    console.log(` - Ya estaban OK:            ${alreadyOk}`);
    console.log(` - Omitidos:                 ${skipped}`);

    console.log('\nSugerencia: revisa el snapshot de empaque y el checklist en la UI.');
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e?.message || e);
    process.exit(1);
  }
}

main();
