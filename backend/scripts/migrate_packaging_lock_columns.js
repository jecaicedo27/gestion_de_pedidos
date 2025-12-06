#!/usr/bin/env node
/**
 * Migra la tabla orders para soportar bloqueo exclusivo de empaque y estado de empaque separado.
 *
 * Agrega columnas (si no existen):
 *  - packaging_status ENUM('not_started','in_progress','paused','blocked_faltante','blocked_novedad','completed') DEFAULT 'not_started'
 *  - packaging_lock_user_id BIGINT UNSIGNED NULL
 *  - packaging_lock_heartbeat_at DATETIME NULL
 *  - packaging_lock_expires_at DATETIME NULL
 *  - packaging_lock_reason VARCHAR(255) NULL
 *
 * Agrega índices (si no existen):
 *  - idx_packaging_status (packaging_status)
 *  - idx_packaging_lock_expires_at (packaging_lock_expires_at)
 *  - idx_packaging_lock_user_id (packaging_lock_user_id)
 *
 * Backfill inicial:
 *  - Si orders.status IN ('en_preparacion','en_empaque') => packaging_status = 'in_progress'
 *  - Si orders.status IN ('empacado','listo_para_entrega') => packaging_status = 'completed'
 *  - En otros casos sin asignación previa => 'not_started'
 *
 * Uso:
 *   node backend/scripts/migrate_packaging_lock_columns.js
 */
const { query, poolEnd } = require('../config/database');

async function columnExists(table, column) {
  const sql = `
    SELECT COUNT(*) AS cnt
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
  `;
  const rows = await query(sql, [table, column]);
  return (rows[0]?.cnt || 0) > 0;
}

async function indexExists(table, indexName) {
  // Usar information_schema.STATISTICS para compatibilidad con MariaDB/MySQL y permitir parámetros
  const rows = await query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?`,
    [table, indexName]
  );
  return (rows[0]?.cnt || 0) > 0;
}

async function safeAlter(sql) {
  try {
    console.log('ALTER:', sql);
    await query(sql);
    console.log('  ✔ ALTER aplicado');
  } catch (err) {
    console.warn('  ⚠️ ALTER falló o ya aplicado:', err.sqlMessage || err.message || err);
  }
}

async function run() {
  try {
    console.log('🔎 Inspeccionando tabla orders...');
    const table = 'orders';

    // 1) Agregar columnas si no existen
    if (!(await columnExists(table, 'packaging_status'))) {
      await safeAlter(`
        ALTER TABLE \`${table}\`
        ADD COLUMN packaging_status ENUM('not_started','in_progress','paused','blocked_faltante','blocked_novedad','completed')
          NULL DEFAULT 'not_started'
          AFTER status
      `);
    } else {
      console.log('  • Columna packaging_status ya existe');
    }

    if (!(await columnExists(table, 'packaging_lock_user_id'))) {
      await safeAlter(`
        ALTER TABLE \`${table}\`
        ADD COLUMN packaging_lock_user_id BIGINT UNSIGNED NULL AFTER packaging_status
      `);
    } else {
      console.log('  • Columna packaging_lock_user_id ya existe');
    }

    if (!(await columnExists(table, 'packaging_lock_heartbeat_at'))) {
      await safeAlter(`
        ALTER TABLE \`${table}\`
        ADD COLUMN packaging_lock_heartbeat_at DATETIME NULL AFTER packaging_lock_user_id
      `);
    } else {
      console.log('  • Columna packaging_lock_heartbeat_at ya existe');
    }

    if (!(await columnExists(table, 'packaging_lock_expires_at'))) {
      await safeAlter(`
        ALTER TABLE \`${table}\`
        ADD COLUMN packaging_lock_expires_at DATETIME NULL AFTER packaging_lock_heartbeat_at
      `);
    } else {
      console.log('  • Columna packaging_lock_expires_at ya existe');
    }

    if (!(await columnExists(table, 'packaging_lock_reason'))) {
      await safeAlter(`
        ALTER TABLE \`${table}\`
        ADD COLUMN packaging_lock_reason VARCHAR(255) NULL AFTER packaging_lock_expires_at
      `);
    } else {
      console.log('  • Columna packaging_lock_reason ya existe');
    }

    // 2) Agregar índices si no existen
    if (!(await indexExists(table, 'idx_packaging_status'))) {
      await safeAlter(`
        ALTER TABLE \`${table}\`
        ADD INDEX idx_packaging_status (packaging_status)
      `);
    } else {
      console.log('  • Índice idx_packaging_status ya existe');
    }

    if (!(await indexExists(table, 'idx_packaging_lock_expires_at'))) {
      await safeAlter(`
        ALTER TABLE \`${table}\`
        ADD INDEX idx_packaging_lock_expires_at (packaging_lock_expires_at)
      `);
    } else {
      console.log('  • Índice idx_packaging_lock_expires_at ya existe');
    }

    if (!(await indexExists(table, 'idx_packaging_lock_user_id'))) {
      await safeAlter(`
        ALTER TABLE \`${table}\`
        ADD INDEX idx_packaging_lock_user_id (packaging_lock_user_id)
      `);
    } else {
      console.log('  • Índice idx_packaging_lock_user_id ya existe');
    }

    // 3) Backfill de packaging_status según estado actual del pedido
    console.log('🧩 Backfill de packaging_status según orders.status...');
    const backfillInProgress = await query(`
      UPDATE \`${table}\`
      SET packaging_status = 'in_progress'
      WHERE packaging_status IS NULL
        AND status IN ('en_preparacion','en_empaque')
    `);
    console.log('  ✔ Asignados "in_progress":', {
      affectedRows: backfillInProgress.affectedRows,
      changedRows: backfillInProgress.changedRows
    });

    const backfillCompleted = await query(`
      UPDATE \`${table}\`
      SET packaging_status = 'completed'
      WHERE packaging_status IS NULL
        AND status IN ('empacado','listo_para_entrega')
    `);
    console.log('  ✔ Asignados "completed":', {
      affectedRows: backfillCompleted.affectedRows,
      changedRows: backfillCompleted.changedRows
    });

    const backfillNotStarted = await query(`
      UPDATE \`${table}\`
      SET packaging_status = 'not_started'
      WHERE packaging_status IS NULL
    `);
    console.log('  ✔ Asignados "not_started":', {
      affectedRows: backfillNotStarted.affectedRows,
      changedRows: backfillNotStarted.changedRows
    });

    // 4) Mostrar DDL final para verificación
    const ddl = await query('SHOW CREATE TABLE `orders`');
    console.log('\n=== SHOW CREATE TABLE orders ===\n');
    console.log(ddl[0]['Create Table']);
    console.log('\n✅ Migración de columnas de lock/estado de empaque finalizada.\n');
  } catch (err) {
    console.error('❌ Error en migración:', err.sqlMessage || err.message || err);
    process.exitCode = 1;
  } finally {
    await poolEnd().catch(() => {});
  }
}

run();
