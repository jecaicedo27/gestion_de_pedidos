/**
 * Portable DB migration for ENUMs and required tables.
 * - Works in dev and prod using the same code path (uses backend/config/database pool).
 * - Idempotent: safe to run multiple times.
 *
 * What it does:
 * 1) Ensure orders.payment_method ENUM includes a superset of values used by the app
 *    ['efectivo','transferencia','tarjeta_credito','pago_electronico','cheque','credito','contraentrega','cortesia','datafono','auto']
 * 2) Ensure siigo_sync_log table exists
 * 3) Ensure siigo_sync_log.sync_type ENUM includes ['webhook','manual','automatic','update']
 *
 * Usage:
 *   node scripts/fix_enums_portable.js
 */
const { query, poolEnd } = require('../config/database');

const PAYMENT_ENUM_SUPERSET = [
  'efectivo',
  'transferencia',
  'tarjeta_credito',
  'pago_electronico',
  'cheque',
  'credito',
  'contraentrega',
  'cortesia',
  'datafono',
  'auto'
];

const SYNC_TYPE_ENUM_SUPERSET = [
  'webhook',
  'manual',
  'automatic',
  'update'
];

async function tableExists(table) {
  try {
    const rows = await query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
      [table]
    );
    return rows.length > 0;
  } catch (e) {
    console.log(`⚠️ Could not check existence for table ${table}:`, e.message);
    return false;
  }
}

async function columnExists(table, column) {
  try {
    const rows = await query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
      [table, column]
    );
    return rows.length > 0;
  } catch (e) {
    console.log(`⚠️ Could not check existence for ${table}.${column}:`, e.message);
    return false;
  }
}

function parseEnumValuesFromType(typeStr) {
  // typeStr example: "enum('a','b','c')"
  const m = typeStr && typeStr.match(/^enum\((.*)\)$/i);
  if (!m) return [];
  // Split carefully by comma outside quotes
  const inner = m[1];
  const parts = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "'" && inner[i - 1] !== '\\') inQuote = !inQuote;
    if (ch === ',' && !inQuote) {
      parts.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur) parts.push(cur.trim());
  return parts
    .map(s => s.replace(/^'/, '').replace(/'$/, '').replace(/\\'/g, "'"));
}

function buildEnumSQL(values) {
  const quoted = values.map(v =>
    `'${String(v).replace(/'/g, "\\'")}'`
  );
  return `ENUM(${quoted.join(',')})`;
}

async function ensureOrdersPaymentEnum() {
  const exists = await tableExists('orders');
  if (!exists) {
    console.log('ℹ️ Table orders does not exist. Skipping payment_method check.');
    return;
  }
  const colExists = await columnExists('orders', 'payment_method');
  if (!colExists) {
    console.log('ℹ️ Column orders.payment_method does not exist. Skipping.');
    return;
  }
  const desc = await query(`SHOW COLUMNS FROM orders LIKE 'payment_method'`);
  const typeStr = desc[0]?.Type || '';
  const current = parseEnumValuesFromType(typeStr).map(v => v.toLowerCase());
  const need = PAYMENT_ENUM_SUPERSET.filter(v => !current.includes(v));
  if (need.length === 0 && current.length >= PAYMENT_ENUM_SUPERSET.length) {
    console.log('✅ orders.payment_method already supports required values:', typeStr);
    return;
  }
  // Use superset explicitly (portable)
  const enumSQL = buildEnumSQL(PAYMENT_ENUM_SUPERSET);
  console.log('🔧 Altering orders.payment_method to', enumSQL);
  await query(`
    ALTER TABLE orders
    MODIFY payment_method ${enumSQL} DEFAULT 'efectivo'
  `);
  console.log('✅ orders.payment_method updated.');
}

async function ensureSiigoSyncLog() {
  const exists = await tableExists('siigo_sync_log');
  if (!exists) {
    console.log('🆕 Creating siigo_sync_log table...');
    await query(`
      CREATE TABLE IF NOT EXISTS siigo_sync_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        siigo_invoice_id VARCHAR(100),
        order_id INT NULL,
        sync_type ENUM('webhook','manual','automatic','update') NOT NULL DEFAULT 'manual',
        sync_status ENUM('success','error','pending') DEFAULT 'pending',
        error_message TEXT NULL,
        processed_at DATETIME NOT NULL,
        INDEX idx_sync_type (sync_type),
        INDEX idx_sync_status (sync_status),
        INDEX idx_processed_at (processed_at),
        INDEX idx_invoice (siigo_invoice_id),
        INDEX idx_order (order_id)
      )
    `);
    console.log('✅ siigo_sync_log created.');
    return;
  }

  // Ensure sync_type column exists
  const syncCol = await columnExists('siigo_sync_log', 'sync_type');
  if (!syncCol) {
    console.log('🔧 Adding sync_type column to siigo_sync_log...');
    await query(`
      ALTER TABLE siigo_sync_log
      ADD COLUMN sync_type ENUM('webhook','manual','automatic','update') NOT NULL DEFAULT 'manual' AFTER order_id
    `);
    console.log('✅ sync_type added.');
  } else {
    // Ensure enum includes required values
    const desc = await query(`SHOW COLUMNS FROM siigo_sync_log LIKE 'sync_type'`);
    const typeStr = desc[0]?.Type || '';
    const current = parseEnumValuesFromType(typeStr).map(v => v.toLowerCase());
    const need = SYNC_TYPE_ENUM_SUPERSET.filter(v => !current.includes(v));
    if (need.length > 0) {
      const enumSQL = buildEnumSQL(
        Array.from(new Set([...current, ...SYNC_TYPE_ENUM_SUPERSET]))
      );
      console.log('🔧 Altering siigo_sync_log.sync_type to', enumSQL);
      await query(`
        ALTER TABLE siigo_sync_log
        MODIFY sync_type ${enumSQL} NOT NULL
      `);
      console.log('✅ siigo_sync_log.sync_type updated.');
    } else {
      console.log('✅ siigo_sync_log.sync_type already supports required values:', typeStr);
    }
  }
}

(async () => {
  try {
    console.log('=== Running portable ENUM migration ===');
    await ensureOrdersPaymentEnum();
    await ensureSiigoSyncLog();
    console.log('=== Migration complete ===');
  } catch (e) {
    console.error('❌ Migration error:', e.code || '', e.message);
    process.exitCode = 1;
  } finally {
    try { await poolEnd(); } catch {}
    process.exit();
  }
})();
