/**
 * Migración idempotente:
 * - Agrega columna invoice_line INT NULL a order_items (si no existe)
 * - Asegura columna product_code VARCHAR(100) (por si falta en entornos antiguos)
 * - Crea índices útiles
 * - Backfill opcional de invoice_line para items existentes (secuencia por order_id según id ASC)
 *
 * Uso:
 *   node backend/scripts/migrate_order_items_invoice_line.js
 */
const { query } = require('../config/database');

async function columnExists(table, column) {
  const rows = await query(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0]?.cnt > 0;
}

async function indexExists(table, indexName) {
  const rows = await query(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  return rows[0]?.cnt > 0;
}

async function addInvoiceLineColumn() {
  const has = await columnExists('order_items', 'invoice_line');
  if (has) {
    console.log('✔️  order_items.invoice_line ya existe');
    return;
  }
  console.log('➕ Agregando columna order_items.invoice_line INT NULL ...');
  await query(`ALTER TABLE order_items ADD COLUMN invoice_line INT NULL AFTER description`);
  console.log('✅ Columna invoice_line agregada');
}

async function ensureProductCodeColumn() {
  const has = await columnExists('order_items', 'product_code');
  if (has) {
    console.log('✔️  order_items.product_code ya existe');
    return;
  }
  console.log('➕ Agregando columna order_items.product_code VARCHAR(100) ...');
  await query(`ALTER TABLE order_items ADD COLUMN product_code VARCHAR(100) NULL AFTER name`);
  console.log('✅ Columna product_code agregada');
}

async function createIndexes() {
  // Índice combinado para búsquedas y ordenamiento por pedido/línea
  const idx1 = 'idx_order_items_order_line';
  if (!(await indexExists('order_items', idx1))) {
    console.log(`➕ Creando índice ${idx1} (order_id, invoice_line, id) ...`);
    await query(`CREATE INDEX ${idx1} ON order_items (order_id, invoice_line, id)`);
    console.log(`✅ Índice ${idx1} creado`);
  } else {
    console.log(`✔️  Índice ${idx1} ya existe`);
  }

  // Índice de apoyo por product_code (si no existía antes)
  const idx2 = 'idx_order_items_product_code';
  if (!(await indexExists('order_items', idx2))) {
    console.log(`➕ Creando índice ${idx2} (product_code) ...`);
    await query(`CREATE INDEX ${idx2} ON order_items (product_code)`);
    console.log(`✅ Índice ${idx2} creado`);
  } else {
    console.log(`✔️  Índice ${idx2} ya existe`);
  }
}

async function backfillInvoiceLine(maxOrdersToProcess = 10000) {
  console.log('🔎 Calculando items sin invoice_line para backfill...');
  const pending = await query(
    `SELECT oi.order_id, COUNT(*) AS cnt
     FROM order_items oi
     WHERE oi.invoice_line IS NULL
     GROUP BY oi.order_id
     ORDER BY oi.order_id
     LIMIT ?`, [maxOrdersToProcess]
  );

  if (!pending.length) {
    console.log('✔️  No hay items con invoice_line NULL. Nada que backfillear.');
    return;
  }

  console.log(`🧮 Se procesarán ${pending.length} órdenes para asignar invoice_line por secuencia id ASC...`);
  let ordersDone = 0;
  for (const row of pending) {
    const orderId = row.order_id;
    const items = await query(
      `SELECT id FROM order_items
       WHERE order_id = ? AND invoice_line IS NULL
       ORDER BY id ASC`, [orderId]
    );

    if (!items.length) continue;

    // Asignar 1..n por el orden actual (id ASC) como aproximación
    let line = 1;
    for (const it of items) {
      try {
        await query(
          `UPDATE order_items SET invoice_line = ? WHERE id = ?`,
          [line, it.id]
        );
        line++;
      } catch (e) {
        console.warn(`⚠️  No se pudo actualizar invoice_line para item ${it.id}:`, e?.message || e);
      }
    }
    ordersDone++;
    if (ordersDone % 100 === 0) {
      console.log(`... ${ordersDone}/${pending.length} órdenes backfilleadas`);
    }
  }
  console.log(`✅ Backfill completado: ${ordersDone} órdenes procesadas`);
}

async function main() {
  try {
    await ensureProductCodeColumn();
    await addInvoiceLineColumn();
    await createIndexes();
    await backfillInvoiceLine();
    console.log('🎉 Migración completada con éxito');
    process.exit(0);
  } catch (e) {
    console.error('❌ Error en migración:', e?.message || e);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
