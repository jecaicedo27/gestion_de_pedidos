#!/usr/bin/env node
/**
 * Quick checker for orders.electronic_payment_type / electronic_payment_notes
 * Usage:
 *   node scripts/check_order_payment_fields.js 14890
 *   node scripts/check_order_payment_fields.js FV-2-14890
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
  try {
    const arg = process.argv[2];
    if (!arg) {
      console.log('Usage:\n  node scripts/check_order_payment_fields.js <orderId|orderNumber>');
      process.exit(1);
    }

    const isNumericId = /^\d+$/.test(arg);
    const whereClause = isNumericId ? 'id = ?' : 'order_number = ?';
    const param = isNumericId ? Number(arg) : String(arg);

    console.log('🔎 Checking order by', isNumericId ? 'ID' : 'Order Number', ':', param);

    const orders = await query(
      `SELECT 
         id, order_number, status, payment_method, 
         electronic_payment_type, electronic_payment_notes, 
         validation_status, updated_at, created_at
       FROM orders 
       WHERE ${whereClause}
       ORDER BY updated_at DESC
       LIMIT 1`,
      [param]
    );

    if (!orders.length) {
      console.log('❌ Order not found');
      return;
    }

    const o = orders[0];
    console.log('\n📦 Order');
    console.table([{
      id: o.id,
      order_number: o.order_number,
      status: o.status,
      payment_method: o.payment_method,
      electronic_payment_type: o.electronic_payment_type,
      electronic_payment_notes: o.electronic_payment_notes,
      validation_status: o.validation_status,
      updated_at: o.updated_at
    }]);

    // Show latest wallet validation for this order (if any)
    const validations = await query(
      `SELECT 
         id, validation_type, validation_status, 
         payment_method, payment_reference, bank_name, payment_amount,
         validated_by, validated_at
       FROM wallet_validations
       WHERE order_id = ?
       ORDER BY validated_at DESC, id DESC
       LIMIT 3`,
      [o.id]
    );

    if (validations.length) {
      console.log('\n🧾 Last wallet validations (max 3):');
      console.table(validations.map(v => ({
        id: v.id,
        type: v.validation_type,
        status: v.validation_status,
        method: v.payment_method,
        bank: v.bank_name,
        reference: v.payment_reference,
        amount: v.payment_amount,
        validated_at: v.validated_at
      })));
    } else {
      console.log('\nℹ️ No wallet validations found for this order yet.');
    }

    console.log('\n✅ Done.');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await poolEnd().catch(() => {});
  }
}

main();
