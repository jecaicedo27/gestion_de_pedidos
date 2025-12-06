#!/usr/bin/env node
/**
 * Get full order JSON (same fields as GET /api/orders) for a given id/order_number.
 * Usage:
 *   node scripts/get_order_full.js 14879
 *   node scripts/get_order_full.js FV-2-14879
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
    console.error('Usage:\n  node scripts/get_order_full.js <id|order_number>');
    process.exit(1);
  }

  const isNumericId = /^\d+$/.test(term);
  const idVal = isNumericId ? Number(term) : 0;

  const rows = await query(
    `SELECT 
        o.id, o.order_number, o.customer_name, o.customer_phone, o.customer_address, 
        o.customer_email, o.customer_city, o.customer_department, o.customer_country,
        o.status, o.total_amount, o.notes, o.delivery_date, o.shipping_date,
        o.payment_method, o.electronic_payment_type, o.electronic_payment_notes, 
        o.delivery_method, o.shipping_payment_method, o.carrier_id, 
        o.created_at, o.updated_at,
        o.siigo_invoice_id, o.siigo_invoice_number, o.siigo_public_url, o.siigo_customer_id,
        o.siigo_observations, o.siigo_payment_info, o.siigo_seller_id, o.siigo_balance,
        o.siigo_document_type, o.siigo_stamp_status, o.siigo_mail_status, o.siigo_invoice_created_at,
        o.delivery_fee,
        o.assigned_messenger_id, o.messenger_status,
        u.full_name as created_by_name,
        assigned_user.full_name as assigned_to_name,
        messenger.username as assigned_messenger_name,
        messenger.full_name as messenger_name
      FROM orders o
      LEFT JOIN users u ON o.created_by = u.id
      LEFT JOIN users assigned_user ON o.assigned_to = assigned_user.id
      LEFT JOIN users messenger ON o.assigned_messenger_id = messenger.id
      WHERE (o.id = ?) OR (o.order_number = ?) OR (o.siigo_invoice_number = ?)
      LIMIT 1`,
    [idVal, term, term]
  );

  if (!rows.length) {
    console.log(JSON.stringify({ success: false, message: 'Order not found' }, null, 2));
    await poolEnd().catch(() => {});
    return;
  }

  const order = rows[0];

  // Fetch items
  const items = await query(
    'SELECT id, name, quantity, price, description FROM order_items WHERE order_id = ?',
    [order.id]
  );
  order.items = items;

  // Emulate the shape used by frontend (response.data)
  const dataShape = {
    orders: [order],
    pagination: { page: 1, limit: 1, total: 1, pages: 1 }
  };

  // Also include the full backend-like envelope for reference
  const backendEnvelope = {
    success: true,
    data: dataShape
  };

  // Print both: first the order object alone, then the envelope, for convenience
  console.log('/* order object */');
  console.log(JSON.stringify(order, null, 2));
  console.log('\n/* backend envelope (like GET /api/orders filtered to this order) */');
  console.log(JSON.stringify(backendEnvelope, null, 2));

  await poolEnd().catch(() => {});
}

main().catch(async (e) => {
  console.error('❌ Error:', e.message);
  await poolEnd().catch(() => {});
  process.exit(1);
});
