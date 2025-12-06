#!/usr/bin/env node
/**
 * Inspecta la estructura y datos de packaging_item_verifications
 * Uso:
 *   node backend/scripts/inspect_packaging_item_verifications_schema.js [orderId]
 * Si se pasa orderId, muestra también filas para ese pedido.
 */
const { query } = require('../config/database');

async function main() {
  try {
    const orderId = process.argv[2] ? Number(process.argv[2]) : null;

    const exists = await query(`SELECT COUNT(*) AS cnt
                                FROM information_schema.TABLES
                                WHERE TABLE_SCHEMA = DATABASE()
                                  AND TABLE_NAME = 'packaging_item_verifications'`);
    if (!exists[0].cnt) {
      console.log('Tabla packaging_item_verifications NO existe.');
      process.exit(0);
    }

    const ddl = await query(`SHOW CREATE TABLE packaging_item_verifications`);
    console.log('\n=== SHOW CREATE TABLE packaging_item_verifications ===\n');
    console.log(ddl[0]['Create Table'], '\n');

    const columns = await query(`DESCRIBE packaging_item_verifications`);
    console.log('=== DESCRIBE packaging_item_verifications ===\n');
    console.table(columns);

    if (orderId) {
      const rows = await query(
        `SELECT order_id, item_id, scanned_count, required_scans, is_verified, verified_by, verified_at, updated_at
         FROM packaging_item_verifications
         WHERE order_id = ?
         ORDER BY item_id
         LIMIT 200`,
        [orderId]
      );
      console.log(`\n=== Filas para order_id=${orderId} (máx 200) ===\n`);
      console.table(rows);
    } else {
      const sample = await query(
        `SELECT order_id, item_id, scanned_count, required_scans, is_verified, verified_by, verified_at, updated_at
         FROM packaging_item_verifications
         ORDER BY updated_at DESC
         LIMIT 50`
      );
      console.log('\n=== Muestra últimas 50 filas ===\n');
      console.table(sample);
    }

  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
