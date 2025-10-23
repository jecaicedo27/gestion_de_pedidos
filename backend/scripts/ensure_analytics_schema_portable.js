// Portable schema alignment for analytics-related columns
// - Adds missing columns used by analytics dashboards and joins
// - Idempotent and safe to re-run
//
// Creates/updates (if missing):
//   customers.document (backfill from identification)
//   orders.customer_document (backfill from customers via siigo_customer_id)
//   orders.shipping_city
//   order_items.product_code, order_items.product_name, order_items.unit_price, order_items.subtotal
//
// Usage:
//   node backend/scripts/ensure_analytics_schema_portable.js

const { query, poolEnd } = require('../config/database');

async function tableExists(table) {
  try {
    const rows = await query(
      'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
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

async function ensureCustomersDocument() {
  const exists = await tableExists('customers');
  if (!exists) {
    console.log('⚠️ Table customers does not exist. Skipping customers.document.');
    return;
  }

  if (!(await columnExists('customers', 'document'))) {
    console.log('📝 Adding customers.document (VARCHAR(50) NULL) ...');
    await query(`
      ALTER TABLE customers
      ADD COLUMN document VARCHAR(50) NULL AFTER identification,
      ADD INDEX idx_customers_document (document)
    `);
    console.log('✅ customers.document added.');
  } else {
    console.log('✅ customers.document already exists');
  }

  // Backfill from identification if empty
  try {
    const res = await query(`
      UPDATE customers
      SET document = identification
      WHERE (document IS NULL OR document = '')
        AND identification IS NOT NULL AND identification <> ''
    `);
    console.log(`🔧 customers.document backfilled from identification (affected: ${res.affectedRows ?? res[0]?.affectedRows ?? 0})`);
  } catch (e) {
    console.log('⚠️ Backfill customers.document skipped:', e.message);
  }
}

async function ensureOrdersAnalyticsColumns() {
  const exists = await tableExists('orders');
  if (!exists) {
    console.log('⚠️ Table orders does not exist. Skipping orders analytics columns.');
    return;
  }

  if (!(await columnExists('orders', 'customer_document'))) {
    console.log('📝 Adding orders.customer_document (VARCHAR(50) NULL) ...');
    await query(`
      ALTER TABLE orders
      ADD COLUMN customer_document VARCHAR(50) NULL AFTER customer_name,
      ADD INDEX idx_orders_customer_document (customer_document)
    `);
    console.log('✅ orders.customer_document added.');
  } else {
    console.log('✅ orders.customer_document already exists');
  }

  if (!(await columnExists('orders', 'shipping_city'))) {
    console.log('📝 Adding orders.shipping_city (VARCHAR(100) NULL) ...');
    try {
      await query(`
        ALTER TABLE orders
        ADD COLUMN shipping_city VARCHAR(100) NULL AFTER shipping_address
      `);
    } catch (e) {
      console.log('ℹ️ shipping_address not found, adding shipping_city at end:', e.message);
      await query(`
        ALTER TABLE orders
        ADD COLUMN shipping_city VARCHAR(100) NULL
      `);
    }
    console.log('✅ orders.shipping_city added.');
  } else {
    console.log('✅ orders.shipping_city already exists');
  }

  // Backfill orders.customer_document using customers.document via siigo_customer_id if available
  try {
    const hasSiigoFk = await columnExists('orders', 'siigo_customer_id');
    if (hasSiigoFk) {
      const res = await query(`
        UPDATE orders o
        JOIN customers c ON c.siigo_id = o.siigo_customer_id
        SET o.customer_document = c.document
        WHERE (o.customer_document IS NULL OR o.customer_document = '')
          AND o.siigo_customer_id IS NOT NULL
          AND c.document IS NOT NULL AND c.document <> ''
      `);
      console.log(`🔧 orders.customer_document backfilled via siigo_customer_id (affected: ${res.affectedRows ?? res[0]?.affectedRows ?? 0})`);
    } else {
      console.log('ℹ️ orders.siigo_customer_id not found. Skipping backfill for orders.customer_document.');
    }
  } catch (e) {
    console.log('⚠️ Backfill orders.customer_document skipped:', e.message);
  }
}

async function ensureOrderItemsColumns() {
  const exists = await tableExists('order_items');
  if (!exists) {
    console.log('⚠️ Table order_items does not exist. Skipping order_items analytics columns.');
    return;
  }

  if (!(await columnExists('order_items', 'product_code'))) {
    console.log('📝 Adding order_items.product_code (VARCHAR(100) NULL) with index ...');
    await query(`
      ALTER TABLE order_items
      ADD COLUMN product_code VARCHAR(100) NULL AFTER name,
      ADD INDEX idx_order_items_product_code (product_code)
    `);
    console.log('✅ order_items.product_code added.');
  } else {
    console.log('✅ order_items.product_code already exists');
  }

  if (!(await columnExists('order_items', 'product_name'))) {
    console.log('📝 Adding order_items.product_name (VARCHAR(255) NULL) ...');
    await query(`
      ALTER TABLE order_items
      ADD COLUMN product_name VARCHAR(255) NULL AFTER product_code
    `);
    console.log('✅ order_items.product_name added.');
  } else {
    console.log('✅ order_items.product_name already exists');
  }

  if (!(await columnExists('order_items', 'unit_price'))) {
    console.log('📝 Adding order_items.unit_price (DECIMAL(10,2) NULL) ...');
    await query(`
      ALTER TABLE order_items
      ADD COLUMN unit_price DECIMAL(10,2) NULL AFTER price
    `);
    console.log('✅ order_items.unit_price added.');
  } else {
    console.log('✅ order_items.unit_price already exists');
  }

  if (!(await columnExists('order_items', 'subtotal'))) {
    console.log('📝 Adding order_items.subtotal (DECIMAL(12,2) NULL) ...');
    await query(`
      ALTER TABLE order_items
      ADD COLUMN subtotal DECIMAL(12,2) NULL AFTER unit_price
    `);
    console.log('✅ order_items.subtotal added.');
  } else {
    console.log('✅ order_items.subtotal already exists');
  }

  // Backfill from existing fields
  try {
    const res1 = await query(`
      UPDATE order_items
      SET product_name = name
      WHERE (product_name IS NULL OR product_name = '')
        AND name IS NOT NULL AND name <> ''
    `);
    console.log(`🔧 order_items.product_name backfilled from name (affected: ${res1.affectedRows ?? res1[0]?.affectedRows ?? 0})`);
  } catch (e) {
    console.log('⚠️ Backfill order_items.product_name skipped:', e.message);
  }

  try {
    const res2 = await query(`
      UPDATE order_items
      SET unit_price = price
      WHERE unit_price IS NULL AND price IS NOT NULL
    `);
    console.log(`🔧 order_items.unit_price backfilled from price (affected: ${res2.affectedRows ?? res2[0]?.affectedRows ?? 0})`);
  } catch (e) {
    console.log('⚠️ Backfill order_items.unit_price skipped:', e.message);
  }

  try {
    const res3 = await query(`
      UPDATE order_items
      SET subtotal = ROUND(COALESCE(unit_price, price) * COALESCE(quantity, 0), 2)
      WHERE subtotal IS NULL
        AND COALESCE(unit_price, price) IS NOT NULL
        AND quantity IS NOT NULL
    `);
    console.log(`🔧 order_items.subtotal computed (affected: ${res3.affectedRows ?? res3[0]?.affectedRows ?? 0})`);
  } catch (e) {
    console.log('⚠️ Compute order_items.subtotal skipped:', e.message);
  }
}

(async () => {
  try {
    console.log('=== Running analytics schema alignment (customers/orders/order_items) ===');
    await ensureCustomersDocument();
    await ensureOrdersAnalyticsColumns();
    await ensureOrderItemsColumns();
    console.log('=== Analytics schema alignment complete ===');
  } catch (e) {
    console.error('❌ Schema alignment error:', e.code || '', e.message);
    process.exitCode = 1;
  } finally {
    try { await poolEnd(); } catch {}
    process.exit();
  }
})();
