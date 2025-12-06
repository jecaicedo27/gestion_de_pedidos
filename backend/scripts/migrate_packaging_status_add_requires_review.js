#!/usr/bin/env node
/**
 * Migra orders.packaging_status para incluir el valor 'requires_review'
 * sin perder los valores existentes.
 *
 * - Lee el ENUM actual desde information_schema
 * - Si no contiene 'requires_review', reconstruye el ENUM agregándolo
 * - Mantiene NULL/DEFAULT 'not_started'
 *
 * Uso:
 *   node backend/scripts/migrate_packaging_status_add_requires_review.js
 */
const { query, poolEnd } = require('../config/database');

async function getEnumValues(table, column) {
  const sql = `
    SELECT COLUMN_TYPE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    LIMIT 1
  `;
  const rows = await query(sql, [table, column]);
  if (!rows.length) {
    throw new Error(`No se encontró ${table}.${column}`);
  }
  const colType = rows[0].COLUMN_TYPE; // ej: enum('a','b','c')
  const match = colType.match(/^enum\((.*)\)$/i);
  if (!match) {
    throw new Error(`${table}.${column} no es ENUM: ${colType}`);
  }
  // Parse values within quotes, supporting commas inside values if any (not expected)
  const values = [];
  let current = '';
  let inStr = false;
  for (let i = 0; i < match[1].length; i++) {
    const ch = match[1][i];
    if (ch === "'" && match[1][i - 1] !== '\\') {
      inStr = !inStr;
      if (!inStr) {
        values.push(current);
        current = '';
      }
    } else if (inStr) {
      current += ch;
    }
  }
  return values;
}

async function modifyEnum(table, column, values, defaultValue = 'not_started') {
  const escaped = values.map(v => `'${v.replace(/'/g, "\\'")}'`).join(',');
  const sql = `
    ALTER TABLE \`${table}\`
    MODIFY COLUMN \`${column}\` ENUM(${escaped})
    NULL DEFAULT '${defaultValue}'
  `;
  await query(sql);
}

(async () => {
  const table = 'orders';
  const column = 'packaging_status';
  try {
    console.log(`🔎 Leyendo ENUM actual de ${table}.${column}...`);
    const current = await getEnumValues(table, column);
    console.log('   Valores actuales:', current);

    const needed = 'requires_review';
    if (current.includes(needed)) {
      console.log('✅ "requires_review" ya está presente. No se requiere cambio.');
    } else {
      // Mantener el orden actual y añadir al final
      const next = [...current, needed];
      console.log('🛠️  Aplicando ALTER para añadir "requires_review"...');
      await modifyEnum(table, column, next, 'not_started');
      const verify = await getEnumValues(table, column);
      console.log('✅ ENUM actualizado:', verify);
      if (!verify.includes(needed)) {
        throw new Error('No se logró añadir "requires_review" al ENUM.');
      }
    }

    // Mostrar columna final
    const col = await query(`
      SHOW COLUMNS FROM \`${table}\` LIKE '${column}'
    `);
    console.log('📋 SHOW COLUMNS:', col[0]);

    console.log('✅ Migración finalizada correctamente.');
  } catch (e) {
    console.error('❌ Error en migración:', e.sqlMessage || e.message || e);
    process.exitCode = 1;
  } finally {
    await poolEnd().catch(() => {});
  }
})();
