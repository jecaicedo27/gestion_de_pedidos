/**
 * Find order rows by order_number fragment or exact, and/or by numeric id.
 * Usage:
 *   node backend/scripts/find_order_by_number.js FV-2-14922
 *   node backend/scripts/find_order_by_number.js 14922
 */
const { query, poolEnd } = require('../config/database');

async function run() {
  const key = process.argv[2];
  if (!key) {
    console.error('Usage: node backend/scripts/find_order_by_number.js <order_number or fragment or id>');
    process.exitCode = 1;
    return;
  }

  let rows = [];
  try {
    if (/^\d+$/.test(key)) {
      // Numeric: try id, exact order_number as numeric string, and LIKE fragment
      rows = await query(
        `SELECT id, order_number, status, delivery_method, payment_method, requires_payment, total_amount, assigned_messenger_id
           FROM orders
          WHERE id = ? OR order_number = ? OR order_number LIKE ?
          ORDER BY id DESC
          LIMIT 10`,
        [Number(key), String(key), '%' + key + '%']
      );
    } else {
      // Text: exact order_number or LIKE
      rows = await query(
        `SELECT id, order_number, status, delivery_method, payment_method, requires_payment, total_amount, assigned_messenger_id
           FROM orders
          WHERE order_number = ? OR order_number LIKE ?
          ORDER BY id DESC
          LIMIT 10`,
        [key, '%' + key + '%']
      );
    }

    if (!rows.length) {
      console.log('No orders matched:', key);
      return;
    }
    console.log('Matches:', rows.length);
    rows.forEach((r) => console.log(r));
  } catch (e) {
    console.error('Error:', e && (e.sqlMessage || e.message) || e);
    process.exitCode = 1;
  } finally {
    await poolEnd().catch(() => {});
  }
}

run();
