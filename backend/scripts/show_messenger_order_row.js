const { query, poolEnd } = require('../config/database');

async function run() {
  const id = Number(process.argv[2]);
  if (!id) {
    console.error('Usage: node backend/scripts/show_messenger_order_row.js <orderId>');
    process.exit(1);
  }
  try {
    const rows = await query(`
      SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.customer_phone,
        o.customer_address,
        o.customer_address as delivery_address,
        o.total_amount as total,
        o.requires_payment,
        o.payment_amount,
        o.payment_method,
        o.shipping_payment_method,
        o.delivery_fee_exempt,
        o.delivery_fee,
        o.siigo_balance,
        o.status,
        o.delivery_method,
        o.created_at,
        o.shipping_date,
        o.notes,
        o.assigned_messenger_id,
        u.full_name as messenger_name,
        o.messenger_status,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS items_count
      FROM orders o
      LEFT JOIN users u ON o.assigned_messenger_id = u.id
      WHERE o.id = ?
    `, [id]);
    console.log(JSON.stringify(rows[0] || null, null, 2));
  } catch (e) {
    console.error('Error:', e && (e.sqlMessage || e.message) || e);
  } finally {
    await poolEnd().catch(() => {});
  }
}

run();
