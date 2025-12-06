/**
 * Agrega la columna updated_at a order_items si no existe.
 * Evita errores "Unknown column 'updated_at' in 'SET'" al actualizar items.
 *
 * Uso:
 *   node backend/scripts/migrate_order_items_add_updated_at.js
 */
const { query } = require('../config/database');

async function columnExists(table, column) {
  const rows = await query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, column]
  );
  return (rows[0]?.cnt || 0) > 0;
}

async function describeTable(table) {
  const ddl = await query(`SHOW CREATE TABLE \`${table}\``);
  console.log(ddl[0]['Create Table'], '\n');
}

(async () => {
  try {
    console.log('🔎 Verificando columna updated_at en order_items...');
    const hasUpdatedAt = await columnExists('order_items', 'updated_at');

    if (!hasUpdatedAt) {
      console.log('🛠️  Agregando columna updated_at DATETIME NULL a order_items...');
      await query(`
        ALTER TABLE order_items
        ADD COLUMN updated_at DATETIME NULL DEFAULT NULL
        AFTER created_at
      `);
      console.log('✅ Columna updated_at agregada.');
    } else {
      console.log('✅ La columna updated_at ya existe.');
    }

    console.log('\n=== Estado final de order_items ===');
    await describeTable('order_items');
    console.log('✅ Migración completada.');
  } catch (e) {
    console.error('❌ Error en la migración:', e?.message || e);
    process.exit(1);
  }
})();
