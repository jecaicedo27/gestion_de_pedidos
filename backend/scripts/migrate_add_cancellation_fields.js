/**
 * Migración segura: agrega campos de cancelación a orders y delivery_tracking.
 *
 * Orders:
 *  - cancelled_at DATETIME NULL
 *  - cancelled_by_user_id INT NULL
 *  - cancellation_reason TEXT NULL
 *  - cancellation_prev_status VARCHAR(50) NULL
 *  - cancellation_logistics_ack_at DATETIME NULL
 *  - cancellation_logistics_ack_by INT NULL
 *
 * Delivery Tracking:
 *  - cancelled_at DATETIME NULL
 *  - cancelled_by_user_id INT NULL
 *  - cancelled_reason TEXT NULL
 *  - status_cancelled TINYINT(1) DEFAULT 0
 *
 * Uso:
 *   node backend/scripts/migrate_add_cancellation_fields.js
 */
const { query, poolEnd } = require('../config/database');

async function tableExists(table) {
  const rows = await query(
    "SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
    [table]
  );
  return (rows[0]?.cnt || 0) > 0;
}

async function columnExists(table, column) {
  const rows = await query(
    "SELECT COUNT(*) AS cnt FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
    [table, column]
  );
  return (rows[0]?.cnt || 0) > 0;
}

async function addOrderColumns() {
  const table = 'orders';
  const exists = await tableExists(table);
  if (!exists) {
    console.error(`❌ La tabla ${table} no existe. Abortando bloque orders.`);
    return;
  }

  const ops = [
    { name: 'cancelled_at', sql: `ALTER TABLE ${table} ADD COLUMN cancelled_at DATETIME NULL AFTER delivered_at` },
    { name: 'cancelled_by_user_id', sql: `ALTER TABLE ${table} ADD COLUMN cancelled_by_user_id INT NULL AFTER cancelled_at` },
    { name: 'cancellation_reason', sql: `ALTER TABLE ${table} ADD COLUMN cancellation_reason TEXT NULL AFTER cancelled_by_user_id` },
    { name: 'cancellation_prev_status', sql: `ALTER TABLE ${table} ADD COLUMN cancellation_prev_status VARCHAR(50) NULL AFTER cancellation_reason` },
    { name: 'cancellation_logistics_ack_at', sql: `ALTER TABLE ${table} ADD COLUMN cancellation_logistics_ack_at DATETIME NULL AFTER cancellation_prev_status` },
    { name: 'cancellation_logistics_ack_by', sql: `ALTER TABLE ${table} ADD COLUMN cancellation_logistics_ack_by INT NULL AFTER cancellation_logistics_ack_at` },
  ];

  for (const op of ops) {
    const has = await columnExists(table, op.name);
    if (!has) {
      console.log(`📝 Agregando columna ${table}.${op.name}...`);
      await query(op.sql);
      console.log(`✅ Columna ${table}.${op.name} agregada`);
    } else {
      console.log(`ℹ️ Columna ${table}.${op.name} ya existe`);
    }
  }
}

async function addDeliveryTrackingColumns() {
  const table = 'delivery_tracking';
  const exists = await tableExists(table);
  if (!exists) {
    console.warn(`⚠️ La tabla ${table} no existe. Saltando bloque delivery_tracking.`);
    return;
  }

  const ops = [
    { name: 'cancelled_at', sql: `ALTER TABLE ${table} ADD COLUMN cancelled_at DATETIME NULL` },
    { name: 'cancelled_by_user_id', sql: `ALTER TABLE ${table} ADD COLUMN cancelled_by_user_id INT NULL` },
    { name: 'cancelled_reason', sql: `ALTER TABLE ${table} ADD COLUMN cancelled_reason TEXT NULL` },
    { name: 'status_cancelled', sql: `ALTER TABLE ${table} ADD COLUMN status_cancelled TINYINT(1) NOT NULL DEFAULT 0` },
  ];

  for (const op of ops) {
    const has = await columnExists(table, op.name);
    if (!has) {
      console.log(`📝 Agregando columna ${table}.${op.name}...`);
      await query(op.sql);
      console.log(`✅ Columna ${table}.${op.name} agregada`);
    } else {
      console.log(`ℹ️ Columna ${table}.${op.name} ya existe`);
    }
  }
}

async function run() {
  console.log('📦 Migración: agregar campos de cancelación a orders y delivery_tracking');
  await addOrderColumns();
  await addDeliveryTrackingColumns();

  // Mostrar resumen de columnas relevantes
  try {
    const ordersCols = await query("SHOW COLUMNS FROM orders");
    const showOrders = ordersCols.filter(r =>
      ['cancelled_at','cancelled_by_user_id','cancellation_reason','cancellation_prev_status','cancellation_logistics_ack_at','cancellation_logistics_ack_by'].includes(r.Field)
    );
    console.log('\n📋 Estructura de orders (cancelación):');
    showOrders.forEach(r => console.log(`- ${r.Field}: ${r.Type} ${r.Null === 'NO' ? 'NOT NULL' : 'NULL'}`));
  } catch (e) {}

  try {
    const dtCols = await query("SHOW COLUMNS FROM delivery_tracking");
    const showDT = dtCols.filter(r =>
      ['cancelled_at','cancelled_by_user_id','cancelled_reason','status_cancelled'].includes(r.Field)
    );
    console.log('\n📋 Estructura de delivery_tracking (cancelación):');
    showDT.forEach(r => console.log(`- ${r.Field}: ${r.Type} ${r.Null === 'NO' ? 'NOT NULL' : 'NULL'} DEFAULT=${r.Default}`));
  } catch (e) {}

  console.log('\n✅ Migración completada.');
}

run()
  .catch((err) => {
    console.error("❌ Error durante la migración:", err && (err.sqlMessage || err.message) || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await poolEnd().catch(() => {});
  });
