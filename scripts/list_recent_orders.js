#!/usr/bin/env node
/**
 * List last N orders to help pick the correct order_number/id for testing.
 * Usage:
 *   node scripts/list_recent_orders.js            // defaults to 30
 *   node scripts/list_recent_orders.js 50         // custom limit
 */
const path = require('path');
// Load dotenv from backend if not available at repo root, then load backend .env
let dotenv;
try {
  dotenv = require('dotenv');
} catch (e) {
  dotenv = require('../backend/node_modules/dotenv');
}
dotenv.config({ path: path.join(__dirname, '../backend/.env') });
const { query, poolEnd } = require('../backend/config/database');

async function main() {
  const limit = Math.max(1, Math.min(parseInt(process.argv[2] || '30', 10) || 30, 200));

  try {
    console.log(`🔎 Listing last ${limit} orders by updated_at DESC...`);
    const rows = await query(
      `SELECT 
         id, order_number, status, payment_method, shipping_date,
         electronic_payment_type, electronic_payment_notes,
         updated_at, created_at
       FROM orders
       ORDER BY updated_at DESC
       LIMIT ?`,
      [limit]
    );

    if (!rows.length) {
      console.log('❌ No orders found');
    } else {
      console.table(rows.map(r => ({
        id: r.id,
        order_number: r.order_number,
        status: r.status,
        payment_method: r.payment_method,
        electronic_payment_type: r.electronic_payment_type,
        shipping_date: r.shipping_date,
        updated_at: r.updated_at
      })));
    }
    console.log('✅ Done.');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await poolEnd().catch(() => {});
  }
}

main();
