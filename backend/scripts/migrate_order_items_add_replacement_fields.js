/**
 * Migra la tabla order_items para soportar reemplazos no destructivos durante empaque:
 * - status ENUM('active','replaced','cancelled') DEFAULT 'active'
 * - replaced_from_item_id INT NULL (traza del ítem original cuando se crea un reemplazo)
 *
 * Uso:
 *   node backend/scripts/migrate_order_items_add_replacement_fields.js
 */
const { query } = require('../config/database');

async function columnExists(table, column) {
  const rows = await query(`
    SELECT COUNT(*) AS cnt
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?`,
    [table, column]
  );
  return (rows[0]?.cnt || 0) > 0;
}

async function indexExists(table, indexName) {
  // Algunos motores no aceptan parámetros en SHOW INDEX; traemos todos y filtramos en JS
  const rows = await query(`SHOW INDEX FROM \`${table}\``);
  return Array.isArray(rows) && rows.some(r => String(r.Key_name) === String(indexName));
}

async function safeAlter(sql) {
  console.log('>> ALTER:', sql);
  await query(sql);
}

async function describeTable(table) {
  const ddl = await query(`SHOW CREATE TABLE \`${table}\``);
  console.log(ddl[0]['Create Table'], '\n');
}

(async () => {
  try {
    console.log('🔎 Verificando columnas en order_items...');
    const hasStatus = await columnExists('order_items', 'status');
    const hasReplacedFrom = await columnExists('order_items', 'replaced_from_item_id');

    if (!hasStatus) {
      console.log('🛠️  Agregando columna status ENUM(\'active\',\'replaced\',\'cancelled\') DEFAULT \'active\' a order_items...');
      await safeAlter(`
        ALTER TABLE order_items
        ADD COLUMN status ENUM('active','replaced','cancelled') NOT NULL DEFAULT 'active'
        AFTER price
      `);
    } else {
      console.log('✅ La columna status ya existe.');
    }

    if (!hasReplacedFrom) {
      console.log('🛠️  Agregando columna replaced_from_item_id INT NULL a order_items...');
      await safeAlter(`
        ALTER TABLE order_items
        ADD COLUMN replaced_from_item_id INT NULL
        AFTER status
      `);
      if (!(await indexExists('order_items', 'idx_order_items_replaced_from'))) {
        await safeAlter(`
          CREATE INDEX idx_order_items_replaced_from ON order_items (replaced_from_item_id)
        `);
      }
    } else {
      console.log('✅ La columna replaced_from_item_id ya existe.');
    }

    // Mostrar estado final
    console.log('\n=== Estado final de order_items ===');
    await describeTable('order_items');

    console.log('✅ Migración completada.');

  } catch (e) {
    console.error('❌ Error en la migración:', e.message);
    process.exit(1);
  }
})();
