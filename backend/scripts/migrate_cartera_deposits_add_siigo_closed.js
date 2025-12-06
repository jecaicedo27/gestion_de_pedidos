#!/usr/bin/env node
/**
 * Migra la tabla `cartera_deposits` agregando columnas para marcar cierre en Siigo:
 * - siigo_closed TINYINT(1) NOT NULL DEFAULT 0
 * - siigo_closed_at DATETIME NULL
 * - siigo_closed_by INT NULL
 *
 * Uso:
 *   node backend/scripts/migrate_cartera_deposits_add_siigo_closed.js
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
    console.log('🔎 Verificando columnas de cierre SIIGO en cartera_deposits...');

    const hasSiigoClosed = await columnExists('cartera_deposits', 'siigo_closed');
    const hasSiigoClosedAt = await columnExists('cartera_deposits', 'siigo_closed_at');
    const hasSiigoClosedBy = await columnExists('cartera_deposits', 'siigo_closed_by');

    if (!hasSiigoClosed) {
      console.log('🛠  Agregando columna siigo_closed...');
      await query(`ALTER TABLE cartera_deposits ADD COLUMN siigo_closed TINYINT(1) NOT NULL DEFAULT 0 AFTER notes`);
      console.log('✅ siigo_closed agregada');
    } else {
      console.log('ℹ️  siigo_closed ya existe');
    }

    if (!hasSiigoClosedAt) {
      console.log('🛠  Agregando columna siigo_closed_at...');
      await query(`ALTER TABLE cartera_deposits ADD COLUMN siigo_closed_at DATETIME NULL AFTER siigo_closed`);
      console.log('✅ siigo_closed_at agregada');
    } else {
      console.log('ℹ️  siigo_closed_at ya existe');
    }

    if (!hasSiigoClosedBy) {
      console.log('🛠  Agregando columna siigo_closed_by...');
      await query(`ALTER TABLE cartera_deposits ADD COLUMN siigo_closed_by INT NULL AFTER siigo_closed_at`);
      console.log('✅ siigo_closed_by agregada');
    } else {
      console.log('ℹ️  siigo_closed_by ya existe');
    }

    console.log('🎯 Migración completada');
  } catch (err) {
    console.error('❌ Error migrando cartera_deposits (siigo_closed):', err);
    process.exitCode = 1;
  } finally {
    try { if (typeof poolEnd === 'function') await poolEnd(); } catch (_) {}
  }
})();
