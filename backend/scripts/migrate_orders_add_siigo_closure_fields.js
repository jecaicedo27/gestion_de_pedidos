/**
 * Migración segura: agrega campos de cierre en SIIGO (flujo Cartera paralelo)
 * - siigo_closed TINYINT(1) NOT NULL DEFAULT 0
 * - siigo_closed_at DATETIME NULL
 * - siigo_closed_by INT NULL
 * - siigo_closure_method ENUM('efectivo','transferencia') NULL
 * - siigo_closure_note VARCHAR(255) NULL
 * - Índice: idx_siigo_closed (siigo_closed)
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
  console.log('🧾 Migración: campos de cierre en SIIGO (orders)');

  const table = 'orders';
  const hasOrders = await tableExists(table);
  if (!hasOrders) {
    console.error('❌ La tabla orders no existe en la base actual.');
    process.exitCode = 1;
    return;
  }

  // 1) siigo_closed TINYINT(1) NOT NULL DEFAULT 0
  if (!(await columnExists(table, 'siigo_closed'))) {
    console.log('📝 Agregando columna siigo_closed TINYINT(1) NOT NULL DEFAULT 0...');
    await query(`ALTER TABLE ${table} ADD COLUMN siigo_closed TINYINT(1) NOT NULL DEFAULT 0`);
    console.log('✅ Columna siigo_closed agregada');
  } else {
    console.log('ℹ️ Columna siigo_closed ya existe');
  }

  // 2) siigo_closed_at DATETIME NULL
  if (!(await columnExists(table, 'siigo_closed_at'))) {
    console.log('📝 Agregando columna siigo_closed_at DATETIME NULL...');
    await query(`ALTER TABLE ${table} ADD COLUMN siigo_closed_at DATETIME NULL`);
    console.log('✅ Columna siigo_closed_at agregada');
  } else {
    console.log('ℹ️ Columna siigo_closed_at ya existe');
  }

  // 3) siigo_closed_by INT NULL
  if (!(await columnExists(table, 'siigo_closed_by'))) {
    console.log('📝 Agregando columna siigo_closed_by INT NULL...');
    await query(`ALTER TABLE ${table} ADD COLUMN siigo_closed_by INT NULL`);
    console.log('✅ Columna siigo_closed_by agregada');
  } else {
    console.log('ℹ️ Columna siigo_closed_by ya existe');
  }

  // 4) siigo_closure_method ENUM('efectivo','transferencia') NULL
  if (!(await columnExists(table, 'siigo_closure_method'))) {
    console.log(`📝 Agregando columna siigo_closure_method ENUM('efectivo','transferencia') NULL...`);
    await query(`ALTER TABLE ${table} ADD COLUMN siigo_closure_method ENUM('efectivo','transferencia') NULL`);
    console.log('✅ Columna siigo_closure_method agregada');
  } else {
    console.log('ℹ️ Columna siigo_closure_method ya existe');
  }

  // 5) siigo_closure_note VARCHAR(255) NULL
  if (!(await columnExists(table, 'siigo_closure_note'))) {
    console.log('📝 Agregando columna siigo_closure_note VARCHAR(255) NULL...');
    await query(`ALTER TABLE ${table} ADD COLUMN siigo_closure_note VARCHAR(255) NULL`);
    console.log('✅ Columna siigo_closure_note agregada');
  } else {
    console.log('ℹ️ Columna siigo_closure_note ya existe');
  }

  // Índice por siigo_closed
  if (await columnExists(table, 'siigo_closed')) {
    if (!(await indexExists(table, 'idx_siigo_closed'))) {
      console.log('🧱 Creando índice idx_siigo_closed (siigo_closed)...');
      await query(`ALTER TABLE ${table} ADD INDEX idx_siigo_closed (siigo_closed)`);
      console.log('✅ Índice idx_siigo_closed creado');
    } else {
      console.log('ℹ️ Índice idx_siigo_closed ya existe');
    }
  }

  // Reporte de estado
  const desc = await query('DESCRIBE orders');
  const fields = ['siigo_closed', 'siigo_closed_at', 'siigo_closed_by', 'siigo_closure_method', 'siigo_closure_note'];
  console.log('\n📋 Estado final de columnas SIIGO en orders:');
  for (const f of fields) {
    const row = desc.find((r) => r.Field === f);
    console.log(`- ${f}: ${row ? `${row.Type} ${row.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${row.Default != null ? `DEFAULT ${row.Default}` : ''}` : 'NO EXISTE'}`);
  }

  console.log('\n✅ Migración de cierre en SIIGO completada.');
}

run()
  .catch((err) => {
    console.error('❌ Error durante la migración:', err?.sqlMessage || err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await poolEnd().catch(() => {});
  });
