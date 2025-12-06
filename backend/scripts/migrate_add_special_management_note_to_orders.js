// Agrega la columna 'special_management_note' a la tabla 'orders' si no existe
// Uso: node backend/scripts/migrate_add_special_management_note_to_orders.js
const { query, poolEnd } = require('../config/database');

async function columnExists() {
  const rows = await query(
    `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'orders'
        AND COLUMN_NAME = 'special_management_note'
      LIMIT 1`
  );
  return rows.length > 0;
}

async function addColumn() {
  await query(
    `ALTER TABLE orders
       ADD COLUMN special_management_note TEXT NULL AFTER notes`
  );
}

async function showPreview() {
  const rows = await query(
    `SELECT id, order_number, status, special_management_note, notes, updated_at
       FROM orders
      ORDER BY id DESC
      LIMIT 3`
  );
  console.log('Preview últimas filas (id, order_number, status, special_management_note, updated_at):');
  for (const r of rows) {
    console.log({
      id: r.id,
      order_number: r.order_number,
      status: r.status,
      special_management_note: r.special_management_note,
      updated_at: r.updated_at,
    });
  }
}

(async () => {
  try {
    const exists = await columnExists();
    if (exists) {
      console.log("La columna 'special_management_note' ya existe en 'orders'.");
      await showPreview();
      return;
    }
    console.log("Agregando columna 'special_management_note' a 'orders'...");
    await addColumn();
    console.log("✔ Columna agregada correctamente.");
    await showPreview();
  } catch (e) {
    console.error('Error en migración:', e && (e.sqlMessage || e.message) || e);
    process.exitCode = 1;
  } finally {
    await poolEnd().catch(() => {});
  }
})();
