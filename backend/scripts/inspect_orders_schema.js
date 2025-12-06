/**
 * Inspect orders table schema and a specific order row.
 * - Prints COLUMN_TYPE for status and messenger_status (to see ENUM values)
 * - Prints sample row for provided order id (ARG1), defaults to latest by id
 */
const { query, poolEnd } = require('../config/database');

async function run() {
  const arg = process.argv[2];
  console.log('🔎 Inspecting orders schema...');

  const desc = await query('DESCRIBE orders');
  const cols = {};
  for (const r of desc) cols[r.Field] = r;

  const showStatus = await query("SHOW COLUMNS FROM orders LIKE 'status'");
  const showMessengerStatus = await query("SHOW COLUMNS FROM orders LIKE 'messenger_status'");

  console.log('\n📋 orders.status:', showStatus[0]?.Type || cols.status?.Type || 'UNKNOWN');
  console.log('📋 orders.messenger_status:', showMessengerStatus[0]?.Type || cols.messenger_status?.Type || 'UNKNOWN');

  const orderId = arg ? Number(arg) : null;
  let row;
  if (orderId) {
    const rows = await query(
      `SELECT id, order_number, status, messenger_status, assigned_messenger_id,
              requires_payment, payment_amount, payment_method, shipping_payment_method,
              delivery_method, delivery_fee_exempt, total_amount, updated_at
       FROM orders WHERE id = ? LIMIT 1`,
      [orderId]
    );
    row = rows[0];
  } else {
    const rows = await query(
      `SELECT id, order_number, status, messenger_status, assigned_messenger_id,
              requires_payment, payment_amount, payment_method, shipping_payment_method,
              delivery_method, delivery_fee_exempt, total_amount, updated_at
       FROM orders ORDER BY id DESC LIMIT 1`
    );
    row = rows[0];
  }

  console.log('\n🧾 Sample order row:', row ? row.id : '(none)');
  console.log(JSON.stringify(row, null, 2));

  // Check allowed enum values by parsing COLUMN_TYPE (no updates)
  const statusType = showStatus[0]?.Type || cols.status?.Type || '';
  const messengerStatusType = showMessengerStatus[0]?.Type || cols.messenger_status?.Type || '';

  const hasEntregado = typeof statusType === 'string' && statusType.includes("'entregado'");
  const hasDelivered = typeof messengerStatusType === 'string' && messengerStatusType.includes("'delivered'");

  console.log('\n🧪 Allowed values check (parsed from COLUMN_TYPE):');
  console.log(' - orders.status contains "entregado"?', hasEntregado ? 'YES' : 'NO');
  console.log(' - orders.messenger_status contains "delivered"?', hasDelivered ? 'YES' : 'NO');
}

run()
  .catch((err) => {
    console.error('Error inspecting orders schema:', err.sqlMessage || err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await poolEnd().catch(() => {});
  });
