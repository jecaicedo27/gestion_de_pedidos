/**
 * Prints siigo_invoice_created_at for a given order_number (exact or LIKE fragment)
 * Usage:
 *   node backend/scripts/get_order_date.js FV-2-14973
 *   node backend/scripts/get_order_date.js 14973
 */
const { query, poolEnd } = require('../config/database');

async function run() {
  const key = process.argv[2];
  if (!key) {
    console.error('Usage: node backend/scripts/get_order_date.js <order_number or fragment>');
    process.exit(1);
  }
  try {
    const db = await query('SELECT DATABASE() AS db');
    console.log('DB:', db[0]?.db);

    const sql = `
      SELECT id, order_number,
             siigo_invoice_created_at,
             DATE(siigo_invoice_created_at) AS ymd,
             created_at
      FROM orders
      WHERE order_number = ? OR order_number LIKE ?
      ORDER BY id DESC
      LIMIT 10
    `;
    const rows = await query(sql, [key, `%${key}%`]);
    if (!rows.length) {
      console.log('No orders found for key:', key);
    } else {
      console.table(rows);
    }
  } catch (e) {
    console.error('Error:', e.sqlMessage || e.message || e);
  } finally {
    await poolEnd().catch(() => {});
  }
}

run();
