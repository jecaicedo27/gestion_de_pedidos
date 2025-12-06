/**
 * Debug helper: prints delivery completion preconditions for an order.
 * Usage: node backend/scripts/debug_order_delivery_conditions.js <orderId>
 */
const { query, poolEnd } = require('../config/database');

async function run() {
  const orderId = Number(process.argv[2]);
  if (!orderId) {
    console.error('Usage: node backend/scripts/debug_order_delivery_conditions.js <orderId>');
    process.exitCode = 1;
    return;
  }

  const rows = await query(
    `SELECT 
       id, order_number, status, messenger_status, assigned_messenger_id,
       requires_payment, payment_amount, payment_method, total_amount, siigo_balance,
       delivery_method, shipping_payment_method, delivery_fee_exempt, delivery_fee, updated_at
     FROM orders WHERE id = ? LIMIT 1`,
    [orderId]
  );
  if (!rows.length) {
    console.log('Order not found:', orderId);
    return;
  }
  const o = rows[0];

  // Compute flags as in controller
  const localThreshold = 150000; // fallback used by controller via configService
  const localMethods = ['domicilio', 'domicilio_ciudad', 'mensajeria_urbana', 'mensajeria_local'];
  const method = String(o.delivery_method || '').toLowerCase();
  const isLocal = localMethods.includes(method);
  const underThreshold = Number(o.total_amount || 0) < Number(localThreshold || 0);
  const shippingPay = String(o.shipping_payment_method || '').toLowerCase();
  const exempt = o.delivery_fee_exempt === 1 || o.delivery_fee_exempt === true;
  const shouldCollectDeliveryFee = isLocal && underThreshold && shippingPay === 'contraentrega' && !exempt;

  const pm = String(o.payment_method || '').toLowerCase();
  const baseRequiresPayment = o.requires_payment === 1 || o.requires_payment === true || o.requires_payment === '1';
  const derivedRequiresPayment =
    ['efectivo', 'contraentrega', 'cash', 'contra-entrega'].includes(pm) ||
    Number(o.siigo_balance || 0) > 0;
  const requiresPayment = baseRequiresPayment || derivedRequiresPayment;

  let expectedAmount = Number(o.payment_amount || 0);
  if (!expectedAmount || expectedAmount <= 0) expectedAmount = Number(o.total_amount || 0);

  const tracking = await query(
    `SELECT id, order_id, messenger_id, assigned_at, accepted_at, started_delivery_at, delivered_at, failed_at,
            payment_collected, delivery_fee_collected, payment_method
       FROM delivery_tracking
      WHERE order_id = ?
      ORDER BY id DESC LIMIT 3`,
    [orderId]
  );

  console.log('=== ORDER DEBUG ===');
  console.log({
    id: o.id,
    order_number: o.order_number,
    status: o.status,
    messenger_status: o.messenger_status,
    assigned_messenger_id: o.assigned_messenger_id,
    requires_payment_flag: o.requires_payment,
    payment_amount: o.payment_amount,
    total_amount: o.total_amount,
    siigo_balance: o.siigo_balance,
    payment_method: o.payment_method,
    delivery_method: o.delivery_method,
    shipping_payment_method: o.shipping_payment_method,
    delivery_fee_exempt: o.delivery_fee_exempt,
    delivery_fee: o.delivery_fee,
    updated_at: o.updated_at
  });

  console.log('\n=== COMPUTED ===');
  console.log({
    localThreshold,
    isLocal,
    underThreshold,
    shippingPay,
    exempt,
    shouldCollectDeliveryFee,
    requiresPayment,
    expectedAmount
  });

  console.log('\n=== TRACKING (last 3) ===');
  console.log(tracking);

  // Hint summary
  console.log('\n=== HINTS ===');
  if (!['in_delivery', 'accepted', 'assigned'].includes(o.messenger_status)) {
    console.log('- messenger_status not in [in_delivery, accepted, assigned] -> controller will 400 unless auto-start is allowed.');
  } else if (o.messenger_status !== 'in_delivery') {
    console.log('- messenger_status is', o.messenger_status, '-> controller will try to auto-start to in_delivery.');
  }
  if (requiresPayment) {
    console.log('- Product payment required. expectedAmount:', expectedAmount);
    console.log('  Frontend must send: productPaymentMethod and either amountReceived (cash) or transferAmount (transfer/mixto) matching rules.');
  } else {
    console.log('- Product payment NOT required (requires_payment = 0 and no derived need).');
  }
  if (shouldCollectDeliveryFee) {
    console.log('- Shipping fee collection required (local + under threshold + contraentrega + not exempt).');
    console.log('  Frontend must send: deliveryFeePaymentMethod (efectivo|transferencia) and deliveryFeeCollected > 0 if efectivo.');
  } else {
    console.log('- Shipping fee collection NOT required by rules.');
  }
}

run()
  .catch((e) => {
    console.error('Error:', e && (e.sqlMessage || e.message) || e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await poolEnd().catch(() => {});
  });
