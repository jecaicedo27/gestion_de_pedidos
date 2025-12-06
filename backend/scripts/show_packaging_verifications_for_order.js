#!/usr/bin/env node
/**
 * Usage:
 *   node backend/scripts/show_packaging_verifications_for_order.js 15066
 *
 * Muestra el estado persistido de empaque parcial por ítem (packaging_item_verifications)
 * para un pedido dado por su número (order_number).
 */

const { query } = require('../config/database');

async function main() {
  try {
    const orderNumber = process.argv[2];
    if (!orderNumber) {
      console.error('Falta parámetro: número de pedido. Ej: node backend/scripts/show_packaging_verifications_for_order.js 15066');
      process.exit(1);
    }

    // Resolver pedido por número o id
    let order = null;
    // 1) por order_number exacto
    let rowsOrder = await query(
      'SELECT id, order_number, customer_name, status, created_at FROM orders WHERE order_number = ? LIMIT 1',
      [orderNumber]
    );
    if (!rowsOrder.length) {
      // 2) por id si es numérico
      const maybeId = Number(orderNumber);
      if (Number.isFinite(maybeId)) {
        rowsOrder = await query(
          'SELECT id, order_number, customer_name, status, created_at FROM orders WHERE id = ? LIMIT 1',
          [maybeId]
        );
      }
    }
    if (!rowsOrder.length) {
      // 3) por LIKE contiene
      rowsOrder = await query(
        'SELECT id, order_number, customer_name, status, created_at FROM orders WHERE order_number LIKE ? ORDER BY created_at DESC LIMIT 1',
        [`%${orderNumber}%`]
      );
    }
    if (!rowsOrder.length) {
      console.error(`Pedido no encontrado con número/id/patrón: ${orderNumber}`);
      process.exit(1);
    }
    order = rowsOrder[0];
    console.log('Pedido:', order);

    // Traer items y su verificación
    const rows = await query(
      `SELECT 
         oi.id            AS item_id,
         oi.name          AS item_name,
         oi.quantity      AS required_quantity,
         piv.scanned_count,
         piv.required_scans,
         piv.is_verified,
         piv.verified_by,
         piv.verified_at,
         piv.updated_at
       FROM order_items oi
       LEFT JOIN packaging_item_verifications piv
         ON piv.order_id = oi.order_id AND piv.item_id = oi.id
       WHERE oi.order_id = ?
       ORDER BY oi.id`,
      [order.id]
    );

    if (!rows.length) {
      console.log('No hay items para este pedido.');
      process.exit(0);
    }

    let verified = 0;
    let withProgress = 0;

    console.log('\nEstado por ítem:');
    for (const r of rows) {
      const scanned = r.scanned_count == null ? null : Number(r.scanned_count);
      const req = r.required_scans == null ? Number(r.required_quantity) : Number(r.required_scans);
      const progress = scanned == null ? '-' : `${scanned}/${req}`;
      if (r.is_verified) verified++;
      if (scanned != null) withProgress++;

      console.log(`- [${r.item_id}] ${r.item_name}`);
      console.log(`    required: ${r.required_quantity} | progress: ${progress} | is_verified: ${!!r.is_verified} | by: ${r.verified_by || '-'} | at: ${r.verified_at || '-'}`);
    }

    console.log('\nResumen:');
    console.log(`- Items con progreso (scanned_count no nulo): ${withProgress}/${rows.length}`);
    console.log(`- Items verificados (is_verified = 1): ${verified}/${rows.length}`);
    console.log('\nSugerencias:');
    console.log('- Si "Items con progreso" es 0 pero escaneaste parcialmente, la persistencia no se está guardando.');
    console.log('- Verifica que exista la tabla packaging_item_verifications y columnas scanned_count/required_scans/is_verified.');
    console.log('- Verifica que el frontend esté usando /api/packaging/verify-barcode/:orderId (escaneo) o /api/packaging/partial/:itemId (manual).');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
