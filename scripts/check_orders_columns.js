#!/usr/bin/env node
/**
 * Checks if orders table has electronic_payment_type and electronic_payment_notes columns.
 */
const path = require('path');
// Ensure backend .env is loaded
let dotenv;
try { dotenv = require('dotenv'); } catch (e) { dotenv = require('../backend/node_modules/dotenv'); }
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const { query, poolEnd } = require('../backend/config/database');

(async () => {
  try {
    const cols = await query(`SHOW COLUMNS FROM orders LIKE 'electronic_payment_type'`);
    const notes = await query(`SHOW COLUMNS FROM orders LIKE 'electronic_payment_notes'`);
    console.log('orders.electronic_payment_type:', cols.length ? 'PRESENT' : 'MISSING');
    console.log('orders.electronic_payment_notes:', notes.length ? 'PRESENT' : 'MISSING');

    // Print current values for a specific order if provided
    const arg = process.argv[2];
    if (arg) {
      const isNumericId = /^\d+$/.test(arg);
      const whereClause = isNumericId ? 'id = ?' : 'order_number = ?';
      const param = isNumericId ? Number(arg) : String(arg);
      const rows = await query(
        `SELECT id, order_number, status, payment_method, electronic_payment_type, electronic_payment_notes, updated_at 
         FROM orders WHERE ${whereClause} LIMIT 1`, [param]
      );
      console.log('\nSample row:');
      console.table(rows);
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await poolEnd().catch(() => {});
  }
})();
