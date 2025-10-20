// Portable schema alignment script for production/dev
// - Ensures missing columns exist in orders and users tables that are required by controllers
// - Tolerates existing columns and re-runnable (idempotent)

const { query, poolEnd } = require('../config/database');

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
  const m = typeStr && typeStr.match(/^enum\((.*)\)$/i);
  if (!m) return [];
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
  return parts.map(s => s.replace(/^'/, '').replace(/'$/, '').replace(/\\'/g, "'"));
}

function buildEnumSQL(values) {
  const quoted = values.map(v => `'${String(v).replace(/'/g, "\\'")}'`);
  return `ENUM(${quoted.join(',')})`;
}

async function ensureUsersColumns() {
  const exists = await tableExists('users');
  if (!exists) {
    console.log('⚠️ Table users does not exist. Skipping users schema alignment.');
    return;
  }

  // active (boolean)
  const hasActive = await columnExists('users', 'active');
  if (!hasActive) {
    console.log('📝 Adding users.active (BOOLEAN DEFAULT TRUE)...');
    await query(`
      ALTER TABLE users
      ADD COLUMN active BOOLEAN DEFAULT TRUE AFTER phone
    `).catch(async (e) => {
      // Fallback for engines that prefer TINYINT(1)
      console.log('   ⚠️ BOOLEAN not supported, falling back to TINYINT(1):', e.message);
      await query(`
        ALTER TABLE users
        ADD COLUMN active TINYINT(1) DEFAULT 1
      `);
    });
    console.log('✅ users.active added.');
  } else {
    console.log('✅ users.active already exists');
  }

  // last_login (datetime)
  const hasLastLogin = await columnExists('users', 'last_login');
  if (!hasLastLogin) {
    console.log('📝 Adding users.last_login (DATETIME NULL)...');
    await query(`
      ALTER TABLE users
      ADD COLUMN last_login DATETIME NULL AFTER created_at
    `);
    console.log('✅ users.last_login added.');
  } else {
    console.log('✅ users.last_login already exists');
  }
}

async function ensureOrdersColumns() {
  const exists = await tableExists('orders');
  if (!exists) {
    console.log('⚠️ Table orders does not exist. Skipping orders schema alignment.');
    return;
  }

  // deleted_at (soft delete)
  if (!(await columnExists('orders', 'deleted_at'))) {
    console.log('📝 Adding orders.deleted_at (TIMESTAMP NULL) with index...');
    await query(`
      ALTER TABLE orders
      ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER updated_at,
      ADD INDEX idx_deleted_at (deleted_at)
    `);
    console.log('✅ orders.deleted_at added.');
  } else {
    console.log('✅ orders.deleted_at already exists');
  }

  // assigned_messenger_id INT NULL
  if (!(await columnExists('orders', 'assigned_messenger_id'))) {
    console.log('📝 Adding orders.assigned_messenger_id (INT NULL) with index...');
    await query(`
      ALTER TABLE orders
      ADD COLUMN assigned_messenger_id INT NULL AFTER carrier_id,
      ADD INDEX idx_orders_assigned_messenger (assigned_messenger_id)
    `);
    console.log('✅ orders.assigned_messenger_id added.');
  } else {
    console.log('✅ orders.assigned_messenger_id already exists');
  }

  // assigned_to INT NULL (legacy assignment column used in reports and controllers)
  if (!(await columnExists('orders', 'assigned_to'))) {
    console.log('📝 Adding orders.assigned_to (INT NULL) with index...');
    await query(`
      ALTER TABLE orders
      ADD COLUMN assigned_to INT NULL AFTER assigned_messenger_id,
      ADD INDEX idx_orders_assigned_to (assigned_to)
    `);
    console.log('✅ orders.assigned_to added.');
  } else {
    console.log('✅ orders.assigned_to already exists');
  }

  // messenger_status ENUM
  const desiredMessengerStatus = [
    'pending_assignment', // pendiente de asignación
    'assigned',
    'accepted',
    'in_delivery',
    'delivered',
    'failed',
    'returned'
  ];
  if (!(await columnExists('orders', 'messenger_status'))) {
    const enumSQL = buildEnumSQL(desiredMessengerStatus);
    console.log(`📝 Adding orders.messenger_status ${enumSQL} NULL with index...`);
    await query(`
      ALTER TABLE orders
      ADD COLUMN messenger_status ${enumSQL} NULL AFTER assigned_messenger_id,
      ADD INDEX idx_orders_messenger_status (messenger_status)
    `);
    console.log('✅ orders.messenger_status added.');
  } else {
    // Ensure superset
    const desc = await query(`SHOW COLUMNS FROM orders LIKE 'messenger_status'`);
    const typeStr = desc[0]?.Type || '';
    const current = parseEnumValuesFromType(typeStr).map(v => v.toLowerCase());
    const need = desiredMessengerStatus.filter(v => !current.includes(v));
    if (need.length) {
      const enumSQL = buildEnumSQL(Array.from(new Set([...current, ...desiredMessengerStatus])));
      console.log('🔧 Altering orders.messenger_status to', enumSQL);
      await query(`
        ALTER TABLE orders
        MODIFY messenger_status ${enumSQL} NULL
      `);
      console.log('✅ orders.messenger_status updated.');
    } else {
      console.log('✅ orders.messenger_status already supports required values:', typeStr);
    }
  }

  // shipping_payment_method VARCHAR(50) NULL
  if (!(await columnExists('orders', 'shipping_payment_method'))) {
    console.log('📝 Adding orders.shipping_payment_method (VARCHAR(50) NULL)...');
    await query(`
      ALTER TABLE orders
      ADD COLUMN shipping_payment_method VARCHAR(50) NULL AFTER payment_method
    `);
    console.log('✅ orders.shipping_payment_method added.');
  } else {
    console.log('✅ orders.shipping_payment_method already exists');
  }

  // carrier_id INT NULL (used in several dashboards)
  if (!(await columnExists('orders', 'carrier_id'))) {
    console.log('📝 Adding orders.carrier_id (INT NULL) with index...');
    await query(`
      ALTER TABLE orders
      ADD COLUMN carrier_id INT NULL AFTER shipping_payment_method,
      ADD INDEX idx_orders_carrier_id (carrier_id)
    `);
    console.log('✅ orders.carrier_id added.');
  } else {
    console.log('✅ orders.carrier_id already exists');
  }

  // delivery_fee DECIMAL(10,2) NULL
  if (!(await columnExists('orders', 'delivery_fee'))) {
    console.log('📝 Adding orders.delivery_fee (DECIMAL(10,2) NULL)...');
    await query(`
      ALTER TABLE orders
      ADD COLUMN delivery_fee DECIMAL(10,2) NULL AFTER total_amount
    `);
    console.log('✅ orders.delivery_fee added.');
  } else {
    console.log('✅ orders.delivery_fee already exists');
  }

  // SIIGO metadata columns used in controllers
  const siigoColumns = [
    ['siigo_invoice_number', "VARCHAR(50) NULL"],
    ['siigo_payment_info', "TEXT NULL"],
    ['siigo_document_type', "VARCHAR(50) NULL"],
    ['siigo_stamp_status', "VARCHAR(50) NULL"],
    ['siigo_mail_status', "VARCHAR(50) NULL"],
    ['siigo_invoice_created_at', "DATETIME NULL"],
  ];

  for (const [col, def] of siigoColumns) {
    if (!(await columnExists('orders', col))) {
      console.log(`📝 Adding orders.${col} (${def})...`);
      await query(`ALTER TABLE orders ADD COLUMN ${col} ${def}`);
      console.log(`✅ orders.${col} added.`);
    } else {
      console.log(`✅ orders.${col} already exists`);
    }
  }
}

(async () => {
  try {
    console.log('=== Running portable schema alignment (orders/users) ===');
    await ensureUsersColumns();
    await ensureOrdersColumns();
    console.log('=== Schema alignment complete ===');
  } catch (e) {
    console.error('❌ Schema alignment error:', e.code || '', e.message);
    process.exitCode = 1;
  } finally {
    try { await poolEnd(); } catch {}
    process.exit();
  }
})();
