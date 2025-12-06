#!/usr/bin/env node
/**
 * Fuerza progreso parcial para un item de un pedido.
 * Uso:
 *   node backend/scripts/set_partial_progress.js <orderId> <itemId> <scanned_count> [required_scans]
 *
 * Ejemplo:
 *   node backend/scripts/set_partial_progress.js 25 796 2
 */
const { query } = require('../config/database');

async function main() {
  try {
    const [orderIdArg, itemIdArg, scannedCountArg, requiredScansArg] = process.argv.slice(2);
    const orderId = Number(orderIdArg);
    const itemId = Number(itemIdArg);
    let scanned_count = Number(scannedCountArg);
    let required_scans = requiredScansArg !== undefined ? Number(requiredScansArg) : null;

    if (!Number.isFinite(orderId) || !Number.isFinite(itemId) || !Number.isFinite(scanned_count)) {
      console.error('Parametros inválidos. Uso: node backend/scripts/set_partial_progress.js <orderId> <itemId> <scanned_count> [required_scans]');
      process.exit(1);
    }

    // Validar que el item pertenezca al pedido y obtener quantity
    const itemRows = await query(
      'SELECT id, order_id, name, quantity FROM order_items WHERE id = ? LIMIT 1',
      [itemId]
    );
    if (!itemRows.length) {
      console.error(`Item ${itemId} no existe`);
      process.exit(1);
    }
    const item = itemRows[0];
    if (item.order_id !== orderId) {
      console.error(`Item ${itemId} no pertenece al pedido ${orderId} (order_id del item: ${item.order_id})`);
      process.exit(1);
    }

    const qty = Number(item.quantity) || 1;
    if (!Number.isFinite(required_scans) || required_scans <= 0) {
      required_scans = qty;
    }

    const isNowVerified = scanned_count >= required_scans;

    const upsert = `
      INSERT INTO packaging_item_verifications 
      (order_id, item_id, scanned_count, required_scans, packed_quantity, verification_notes, is_verified, verified_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'parcial_script')
      ON DUPLICATE KEY UPDATE
        scanned_count = VALUES(scanned_count),
        required_scans = VALUES(required_scans),
        packed_quantity = COALESCE(packed_quantity, VALUES(packed_quantity)),
        verification_notes = VALUES(verification_notes),
        is_verified = VALUES(is_verified),
        updated_at = CURRENT_TIMESTAMP
    `;
    await query(upsert, [
      orderId,
      itemId,
      scanned_count,
      required_scans,
      scanned_count,
      `Progreso parcial (script): ${scanned_count}/${required_scans}`,
      isNowVerified
    ]);

    if (isNowVerified) {
      await query(
        `UPDATE packaging_item_verifications 
         SET verified_at = COALESCE(verified_at, CURRENT_TIMESTAMP) 
         WHERE order_id = ? AND item_id = ?`,
        [orderId, itemId]
      );
    }

    const row = await query(
      `SELECT order_id, item_id, scanned_count, required_scans, is_verified, verified_by, verified_at, updated_at
       FROM packaging_item_verifications
       WHERE order_id = ? AND item_id = ?`,
      [orderId, itemId]
    );

    console.log('OK:', {
      orderId,
      itemId,
      item_name: item.name,
      quantity_required: qty,
      set_scanned_count: scanned_count,
      set_required_scans: required_scans,
      is_verified: isNowVerified,
      row: row[0] || null
    });
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
