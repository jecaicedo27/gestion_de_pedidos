/**
 * Migra la tabla order_items para agregar la columna invoice_line si no existe.
 * Uso:
 *   node backend/scripts/migrate_add_invoice_line_to_order_items.js
 */
const { query, poolEnd } = require('../config/database');

async function columnExists(table, column) {
  const rows = await query(
    `SELECT COUNT(*) AS c
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?`,
    [table, column]
  );
  return (rows[0]?.c || 0) > 0;
}

async function describeTable(table) {
  const rows = await query(`DESCRIBE \`${table}\``);
  console.log(`\n📋 DESCRIBE ${table}:`);
  for (const r of rows) {
    console.log(` - ${r.Field} ${r.Type} ${r.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${r.Key ? r.Key : ''} ${r.Default !== null ? 'DEFAULT ' + r.Default : ''}`);
  }
}

async function run() {
  try {
    console.log('🔎 Verificando existencia de columna invoice_line en order_items...');
    const exists = await columnExists('order_items', 'invoice_line');

    if (exists) {
      console.log('✅ La columna invoice_line ya existe. No se requiere migración.');
      await describeTable('order_items');
      return;
    }

    console.log('🛠️  Agregando columna invoice_line (INT NULL) a order_items...');
    await query(`ALTER TABLE order_items ADD COLUMN invoice_line INT NULL AFTER description`);

    // (Opcional) índice si se consulta por invoice_line
    // await query(\`CREATE INDEX idx_order_items_invoice_line ON order_items (invoice_line)\`);

    console.log('✅ Columna invoice_line agregada exitosamente.');
    await describeTable('order_items');
  } catch (e) {
    console.error('❌ Error ejecutando migración:', e.sqlMessage || e.message || e);
    process.exitCode = 1;
  } finally {
    await poolEnd().catch(() => {});
  }
}

run();
