#!/usr/bin/env node
/**
 * Migra la tabla `cartera_deposits` agregando columnas de motivo:
 * - reason_code VARCHAR(64) NULL
 * - reason_text VARCHAR(255) NULL
 *
 * Uso:
 *   node backend/scripts/migrate_cartera_deposits_add_reason.js
 */
const { query, poolEnd } = require('../config/database');

async function columnExists(table, column) {
  const rows = await query(
    `SELECT 1 
       FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = ? 
        AND COLUMN_NAME = ? 
      LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

(async () => {
  try {
    console.log('🔎 Verificando columnas en cartera_deposits...');
    const hasReasonCode = await columnExists('cartera_deposits', 'reason_code');
    const hasReasonText = await columnExists('cartera_deposits', 'reason_text');

    if (!hasReasonCode) {
      console.log('🛠  Agregando columna reason_code a cartera_deposits...');
      await query(`ALTER TABLE cartera_deposits ADD COLUMN reason_code VARCHAR(64) NULL AFTER reference_number`, []);
      console.log('✅ reason_code agregada');
    } else {
      console.log('ℹ️  reason_code ya existe');
    }

    if (!hasReasonText) {
      console.log('🛠  Agregando columna reason_text a cartera_deposits...');
      await query(`ALTER TABLE cartera_deposits ADD COLUMN reason_text VARCHAR(255) NULL AFTER reason_code`, []);
      console.log('✅ reason_text agregada');
    } else {
      console.log('ℹ️  reason_text ya existe');
    }

    console.log('🎯 Migración completada');
  } catch (err) {
    console.error('❌ Error migrando cartera_deposits:', err);
    process.exitCode = 1;
  } finally {
    try { if (typeof poolEnd === 'function') await poolEnd(); } catch (_) {}
  }
})();
