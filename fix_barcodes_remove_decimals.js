// Usar dependencias desde backend/node_modules para evitar faltantes en raíz
const mysql = require('./backend/node_modules/mysql2/promise');
const dotenv = require('./backend/node_modules/dotenv');
dotenv.config({ path: 'backend/.env' });

function normalizeBarcode(input) {
  if (input === null || input === undefined) return null;
  let s = String(input).trim();
  s = s.replace(/,/g, '.').replace(/\s+/g, '');
  if (/^\d+(?:\.\d+)?$/.test(s)) {
    return s.split('.')[0];
  }
  return s;
}

async function cleanTable(connection, table, idCol, barcodeCol) {
  console.log(`\n🧹 Limpiando barcodes en ${table}.${barcodeCol} ...`);
  const [rows] = await connection.execute(
    `SELECT ${idCol} AS id, ${barcodeCol} AS barcode FROM ${table} WHERE ${barcodeCol} IS NOT NULL AND ${barcodeCol} <> ''`
  );

  let updated = 0;
  let skipped = 0;
  let conflicts = 0;

  for (const row of rows) {
    const original = row.barcode;
    const cleaned = normalizeBarcode(original);
    if (!cleaned || cleaned === original) {
      skipped++;
      continue;
    }
    try {
      await connection.execute(
        `UPDATE ${table} SET ${barcodeCol} = ? WHERE ${idCol} = ?`,
        [cleaned, row.id]
      );
      updated++;
      if (updated % 50 === 0) process.stdout.write('.');
    } catch (err) {
      // Manejo de duplicados por índice único
      if (err && err.code === 'ER_DUP_ENTRY') {
        console.warn(`\n⚠️  Conflicto por duplicado en ${table}.${barcodeCol}: ${original} -> ${cleaned} (id=${row.id}). Se omite.`);
        conflicts++;
        continue;
      }
      console.error(`\n❌ Error actualizando ${table} id=${row.id}:`, err.message);
    }
  }

  console.log(`\n✅ ${table}: ${updated} actualizados, ${skipped} sin cambios, ${conflicts} conflictos (omitidos)`);
  return { updated, skipped, conflicts };
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'gestion_pedidos'
  });

  console.log('🔗 Conectado a la base de datos');

  try {
    const totals = { updated: 0, skipped: 0, conflicts: 0 };

    // Limpiar tabla principal de productos
    const r1 = await cleanTable(connection, 'products', 'id', 'barcode');
    totals.updated += r1.updated; totals.skipped += r1.skipped; totals.conflicts += r1.conflicts;

    // Limpiar variantes si existen
    try {
      const [chk] = await connection.execute("SHOW TABLES LIKE 'product_variants'");
      if (chk.length > 0) {
        const r2 = await cleanTable(connection, 'product_variants', 'id', 'variant_barcode');
        totals.updated += r2.updated; totals.skipped += r2.skipped; totals.conflicts += r2.conflicts;
      }
    } catch (e) {
      console.warn('ℹ️  No se pudo verificar product_variants:', e.message);
    }

    console.log(`\n📊 Resumen limpieza: ${totals.updated} actualizados, ${totals.skipped} sin cambios, ${totals.conflicts} conflictos`);

  } finally {
    await connection.end();
    console.log('🔌 Conexión cerrada');
  }
}

main().catch(err => {
  console.error('❌ Error general:', err);
  process.exit(1);
});
