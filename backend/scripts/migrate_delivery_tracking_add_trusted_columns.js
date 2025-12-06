/**
 * Migra delivery_tracking para soportar "Entrega con confianza".
 * Agrega columnas:
 *  - trusted_delivery TINYINT(1) NOT NULL DEFAULT 0
 *  - trusted_authorized_by INT NULL
 *  - trusted_note VARCHAR(255) NULL
 *  - trusted_sla_until DATETIME NULL
 *
 * Uso:
 *   node backend/scripts/migrate_delivery_tracking_add_trusted_columns.js
 */
const { query, poolEnd } = require('../config/database');

async function columnExists(table, column) {
  const rows = await query(
    `SELECT 1 AS ok
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1`,
    [table, column]
  );
  return !!(rows && rows.length);
}

async function migrate() {
  console.log('🛠  Migración: agregar columnas trusted_* a delivery_tracking (Entrega con confianza)');
  const table = 'delivery_tracking';

  try {
    const hasTrustedDelivery = await columnExists(table, 'trusted_delivery');
    const hasTrustedAuthorizedBy = await columnExists(table, 'trusted_authorized_by');
    const hasTrustedNote = await columnExists(table, 'trusted_note');
    const hasTrustedSlaUntil = await columnExists(table, 'trusted_sla_until');

    if (!hasTrustedDelivery) {
      console.log('➕ Agregando column trusted_delivery TINYINT(1) NOT NULL DEFAULT 0...');
      await query(`ALTER TABLE ${table} ADD COLUMN trusted_delivery TINYINT(1) NOT NULL DEFAULT 0 AFTER delivery_longitude`);
      console.log('✅ trusted_delivery agregada');
    } else {
      console.log('ℹ️ trusted_delivery ya existe');
    }

    if (!hasTrustedAuthorizedBy) {
      console.log('➕ Agregando column trusted_authorized_by INT NULL...');
      await query(`ALTER TABLE ${table} ADD COLUMN trusted_authorized_by INT NULL AFTER trusted_delivery`);
      console.log('✅ trusted_authorized_by agregada');
    } else {
      console.log('ℹ️ trusted_authorized_by ya existe');
    }

    if (!hasTrustedNote) {
      console.log('➕ Agregando column trusted_note VARCHAR(255) NULL...');
      await query(`ALTER TABLE ${table} ADD COLUMN trusted_note VARCHAR(255) NULL AFTER trusted_authorized_by`);
      console.log('✅ trusted_note agregada');
    } else {
      console.log('ℹ️ trusted_note ya existe');
    }

    if (!hasTrustedSlaUntil) {
      console.log('➕ Agregando column trusted_sla_until DATETIME NULL...');
      await query(`ALTER TABLE ${table} ADD COLUMN trusted_sla_until DATETIME NULL AFTER trusted_note`);
      console.log('✅ trusted_sla_until agregada');
    } else {
      console.log('ℹ️ trusted_sla_until ya existe');
    }

    console.log('🎉 Migración trusted_* en delivery_tracking completada.');
  } catch (err) {
    console.error('❌ Error en migración delivery_tracking.trusted_*:', err);
    process.exitCode = 1;
  } finally {
    try { await poolEnd(); } catch (_) {}
  }
}

migrate();
