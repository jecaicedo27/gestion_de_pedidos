#!/usr/bin/env node
/**
 * Ajusta el esquema y datos de packaging_item_verifications para soportar progreso parcial real.
 *
 * Cambios:
 *  - Quita defaults problemáticos:
 *      * required_scans deja de tener DEFAULT 1 (pasa a NULL por defecto)
 *      * verified_at deja de ser NOT NULL con DEFAULT CURRENT_TIMESTAMP (pasa a NULL por defecto)
 *      * (opcional) scanned_count pasa a permitir NULL y DEFAULT NULL (para distinguir "sin progreso" de 0)
 *  - Backfill:
 *      * required_scans = quantity del item cuando esté NULL, 0, 1 o menor que la cantidad requerida
 *      * Si is_verified = 1 y scanned_count < required_scans, entonces scanned_count = required_scans y verified_at NOW()
 *      * Si is_verified = 0 y scanned_count = 0, lo dejamos como 0 o lo ponemos NULL (aquí lo pondremos NULL para UI "-")
 *
 * Uso:
 *   node backend/scripts/migrate_packaging_verifications_fix_defaults.js [orderId_inspect]
 */
const { query } = require('../config/database');

async function safeAlter(sql, params = []) {
  try {
    console.log('ALTER:', sql);
    await query(sql, params);
    console.log('  ✔ ALTER aplicado');
  } catch (err) {
    console.warn('  ⚠️ ALTER falló o ya aplicado:', err.message || err);
  }
}

async function main() {
  try {
    const inspectOrderId = process.argv[2] ? Number(process.argv[2]) : null;

    // Verificar existencia de tabla
    const exists = await query(`
      SELECT COUNT(*) AS cnt
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'packaging_item_verifications'
    `);
    if (!exists[0].cnt) {
      console.error('❌ Tabla packaging_item_verifications NO existe. Abortando.');
      process.exit(1);
    }

    console.log('=== Estado actual (SHOW CREATE TABLE) ===');
    const ddlBefore = await query('SHOW CREATE TABLE packaging_item_verifications');
    console.log(ddlBefore[0]['Create Table'], '\n');

    // 1) Cambios de esquema
    await safeAlter(`ALTER TABLE packaging_item_verifications 
      MODIFY required_scans INT NULL DEFAULT NULL
    `);

    await safeAlter(`ALTER TABLE packaging_item_verifications 
      MODIFY verified_at DATETIME NULL DEFAULT NULL
    `);

    await safeAlter(`ALTER TABLE packaging_item_verifications 
      MODIFY scanned_count INT NULL DEFAULT NULL
    `);

    console.log('\n=== Backfill de datos ===');

    // 2) Backfill: required_scans = quantity del item cuando corresponda
    const backfillRequired = await query(`
      UPDATE packaging_item_verifications piv
      JOIN order_items oi ON oi.id = piv.item_id AND oi.order_id = piv.order_id
      SET piv.required_scans = oi.quantity
      WHERE piv.required_scans IS NULL 
         OR piv.required_scans = 0
         OR piv.required_scans = 1
         OR piv.required_scans < oi.quantity
    `);
    console.log('  ✔ Backfill required_scans →', {
      affectedRows: backfillRequired.affectedRows,
      changedRows: backfillRequired.changedRows
    });

    // 3) Para filas ya verificadas manualmente pero con contadores inconsistentes
    const fixVerified = await query(`
      UPDATE packaging_item_verifications piv
      SET 
        piv.scanned_count = piv.required_scans,
        piv.verified_at = COALESCE(piv.verified_at, NOW())
      WHERE piv.is_verified = 1
        AND (piv.scanned_count IS NULL OR piv.scanned_count < piv.required_scans)
    `);
    console.log('  ✔ Ajuste is_verified con scanned_count < required_scans →', {
      affectedRows: fixVerified.affectedRows,
      changedRows: fixVerified.changedRows
    });

    // 4) Opcional: dejar en NULL los "0" sin progreso (mejor UX: muestra "-")
    const nullifyZeros = await query(`
      UPDATE packaging_item_verifications
      SET scanned_count = NULL
      WHERE is_verified = 0
        AND scanned_count = 0
    `);
    console.log('  ✔ Normalización scanned_count 0 → NULL (no verificado) →', {
      affectedRows: nullifyZeros.affectedRows,
      changedRows: nullifyZeros.changedRows
    });

    console.log('\n=== Estado final (SHOW CREATE TABLE) ===');
    const ddlAfter = await query('SHOW CREATE TABLE packaging_item_verifications');
    console.log(ddlAfter[0]['Create Table'], '\n');

    // 5) Inspección de un pedido específico si se pasa como argumento
    if (inspectOrderId) {
      const rows = await query(
        `SELECT order_id, item_id, scanned_count, required_scans, is_verified, verified_by, verified_at, updated_at
         FROM packaging_item_verifications
         WHERE order_id = ?
         ORDER BY item_id`,
        [inspectOrderId]
      );
      console.log(`=== Verificaciones para order_id=${inspectOrderId} ===`);
      console.table(rows);
    }

    console.log('\n✅ Migración terminada.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en migración:', err);
    process.exit(1);
  }
}

main();
