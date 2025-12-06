#!/usr/bin/env node
/**
 * Find orders by ID or by partial order_number
 * Usage:
 *   node scripts/find_order.js 12882
 *   node scripts/find_order.js FV-2-12882
 *   node scripts/find_order.js 14891
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
  const term = process.argv[2];
  if (!term) {
    console.log('Usage:\n  node scripts/find_order.js <id|order_number|partial>');
    process.exit(1);
  }

  try {
    const isNumericId = /^\d+$/.test(term);
    const likeTerm = `%${term}%`;

    console.log('🔎 Searching orders for:', term);

    const rows = await query(
      `SELECT 
         id, order_number, status, payment_method, shipping_date, 
         electronic_payment_type, electronic_payment_notes, updated_at, created_at
       FROM orders
       WHERE 
         (order_number = ?)
         OR (order_number LIKE ?)
         ${isNumericId ? 'OR (id = ?)' : ''}
       ORDER BY updated_at DESC
       LIMIT 20`,
      isNumericId ? [term, likeTerm, Number(term)] : [term, likeTerm]
    );

    if (!rows.length) {
      console.log('❌ No matching orders found');
    } else {
      console.log('\n📦 Matches:');
      console.table(rows.map(r => ({
        id: r.id,
        order_number: r.order_number,
        status: r.status,
        payment_method: r.payment_method,
        electronic_payment_type: r.electronic_payment_type,
        shipping_date: r.shipping_date,
        updated_at: r.updated_at
      })));
      console.log(`\n✅ Found ${rows.length} orders`);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await poolEnd().catch(() => {});
  }
}

main();
