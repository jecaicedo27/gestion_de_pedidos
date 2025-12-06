/**
 * Inspect delivery_tracking table schema.
 * - Prints column name, type, nullability, default
 * - Prints ENUM values for payment_method and delivery_fee_payment_method
 */
const { query, poolEnd } = require('../config/database');

async function run() {
  console.log('🔎 Inspecting delivery_tracking schema...');
  const rows = await query('SHOW COLUMNS FROM delivery_tracking');
  for (const r of rows) {
    console.log(`${r.Field} | Type=${r.Type} | Null=${r.Null} | Key=${r.Key} | Default=${r.Default} | Extra=${r.Extra}`);
  }

  const pm = rows.find(r => r.Field === 'payment_method');
  const feePm = rows.find(r => r.Field === 'delivery_fee_payment_method');
  console.log('\n📋 ENUMs:');
  console.log('payment_method:', pm ? pm.Type : '(not found)');
  console.log('delivery_fee_payment_method:', feePm ? feePm.Type : '(not found)');
}

run()
  .catch((err) => {
    console.error('Error inspecting delivery_tracking schema:', err.sqlMessage || err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await poolEnd().catch(() => {});
  });
