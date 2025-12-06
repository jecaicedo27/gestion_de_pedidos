#!/usr/bin/env node
/**
 * Migración segura: agregar columna paid_amount a orders si no existe.
 * - paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0
 */
const { pool } = require('../config/database');

async function columnExists(conn, table, column) {
  const col = String(column).replace(/`/g, '');
  const [rows] = await conn.query(`SHOW COLUMNS FROM \`${table}\` LIKE '${col}'`);
  return rows && rows.length > 0;
}

(async () => {
  let conn;
  try {
    console.log('🚀 Verificando columna paid_amount en orders...');
    conn = await pool.getConnection();

    const table = 'orders';
    const hasPaidAmount = await columnExists(conn, table, 'paid_amount');

    if (hasPaidAmount) {
      console.log('✅ La columna paid_amount ya existe.');
    } else {
      console.log('➕ Agregando columna paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0...');
      await conn.execute(
        `ALTER TABLE \`${table}\` ADD COLUMN paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER payment_amount`
      );
      console.log('✅ Columna paid_amount agregada correctamente.');
    }

    console.log('🏁 Migración completada.');
  } catch (err) {
    console.error('❌ Error en migración:', err && (err.sqlMessage || err.message) || err);
    process.exitCode = 1;
  } finally {
    if (conn) conn.release();
  }
})();
