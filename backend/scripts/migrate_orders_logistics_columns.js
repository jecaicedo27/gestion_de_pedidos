/**
 * Migración segura: asegura columnas de logística en orders
 * - carrier_id INT NULL
 * - tracking_number VARCHAR(100) NULL
 * - shipping_guide_generated TINYINT(1)/BOOLEAN DEFAULT 0
 * - shipping_guide_path VARCHAR(255) NULL
 * y crea índices si no existen:
 * - idx_carrier_id (carrier_id)
 * - idx_tracking_number (tracking_number)
 *
 * Usa el pool/config existente de backend (config/database).
 */
const { query, poolEnd } = require('../config/database');

async function columnExists(table, column) {
  const rows = await query(
    `SELECT COUNT(*) AS cnt
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?`,
    [table, column]
  );
  return Number(rows?.[0]?.cnt || 0) > 0;
}

async function indexExists(table, indexName) {
  const rows = await query(
    `SELECT COUNT(*) AS cnt
       FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND index_name = ?`,
    [table, indexName]
  );
  return Number(rows?.[0]?.cnt || 0) > 0;
}

async function tableExists(table) {
  const rows = await query(
    `SELECT COUNT(*) AS cnt
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ?`,
    [table]
  );
  return Number(rows?.[0]?.cnt || 0) > 0;
}

async function run() {
  console.log('🚚 Migración segura de columns en orders (logística)');

  const table = 'orders';
  const hasOrders = await tableExists(table);
  if (!hasOrders) {
    console.error('❌ La tabla orders no existe en la base actual.');
    process.exitCode = 1;
    return;
  }

  // 1) carrier_id INT NULL
  if (!(await columnExists(table, 'carrier_id'))) {
    console.log('📝 Agregando columna carrier_id INT NULL...');
    await query(`ALTER TABLE ${table} ADD COLUMN carrier_id INT NULL`);
    console.log('✅ Columna carrier_id agregada');
  } else {
    console.log('ℹ️ Columna carrier_id ya existe');
  }

  // 2) tracking_number VARCHAR(100) NULL
  if (!(await columnExists(table, 'tracking_number'))) {
    console.log('📝 Agregando columna tracking_number VARCHAR(100) NULL...');
    await query(`ALTER TABLE ${table} ADD COLUMN tracking_number VARCHAR(100) NULL`);
    console.log('✅ Columna tracking_number agregada');
  } else {
    console.log('ℹ️ Columna tracking_number ya existe');
  }

  // 3) shipping_guide_generated BOOLEAN/TINYINT(1) DEFAULT 0
  if (!(await columnExists(table, 'shipping_guide_generated'))) {
    console.log('📝 Agregando columna shipping_guide_generated TINYINT(1) DEFAULT 0...');
    await query(`ALTER TABLE ${table} ADD COLUMN shipping_guide_generated TINYINT(1) NOT NULL DEFAULT 0`);
    console.log('✅ Columna shipping_guide_generated agregada');
  } else {
    console.log('ℹ️ Columna shipping_guide_generated ya existe');
  }

  // 4) shipping_guide_path VARCHAR(255) NULL
  if (!(await columnExists(table, 'shipping_guide_path'))) {
    console.log('📝 Agregando columna shipping_guide_path VARCHAR(255) NULL...');
    await query(`ALTER TABLE ${table} ADD COLUMN shipping_guide_path VARCHAR(255) NULL`);
    console.log('✅ Columna shipping_guide_path agregada');
  } else {
    console.log('ℹ️ Columna shipping_guide_path ya existe');
  }

  // Índices
  if (await columnExists(table, 'carrier_id')) {
    if (!(await indexExists(table, 'idx_carrier_id'))) {
      console.log('🧱 Creando índice idx_carrier_id...');
      await query(`ALTER TABLE ${table} ADD INDEX idx_carrier_id (carrier_id)`);
      console.log('✅ Índice idx_carrier_id creado');
    } else {
      console.log('ℹ️ Índice idx_carrier_id ya existe');
    }
  }

  if (await columnExists(table, 'tracking_number')) {
    if (!(await indexExists(table, 'idx_tracking_number'))) {
      console.log('🧱 Creando índice idx_tracking_number...');
      await query(`ALTER TABLE ${table} ADD INDEX idx_tracking_number (tracking_number)`);
      console.log('✅ Índice idx_tracking_number creado');
    } else {
      console.log('ℹ️ Índice idx_tracking_number ya existe');
    }
  }

  // Reporte de estado
  const desc = await query('DESCRIBE orders');
  const fields = ['carrier_id', 'tracking_number', 'shipping_guide_generated', 'shipping_guide_path'];
  console.log('\n📋 Estado final de columnas relevantes en orders:');
  for (const f of fields) {
    const row = desc.find((r) => r.Field === f);
    console.log(`- ${f}: ${row ? `${row.Type} ${row.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${row.Default != null ? `DEFAULT ${row.Default}` : ''}` : 'NO EXISTE'}`);
  }

  console.log('\n✅ Migración completada.');
}

run()
  .catch((err) => {
    console.error('❌ Error durante la migración:', err?.sqlMessage || err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await poolEnd().catch(() => {});
  });
