const { query, poolEnd } = require('../config/database');

async function run() {
  const idOrNumber = process.argv[2];
  const amtArg = process.argv[3];
  if (!idOrNumber || !amtArg) {
    console.error('Usage: node backend/scripts/mark_order_requires_payment.js <orderId|order_number> <cash_amount>');
    process.exit(1);
  }
  const cashAmount = Number(amtArg);
  if (!Number.isFinite(cashAmount) || cashAmount <= 0) {
    console.error('Invalid cash_amount. Provide a positive number.');
    process.exit(1);
  }

  try {
    let rows;
    if (/^\d+$/.test(idOrNumber)) {
      rows = await query('SELECT id, order_number, requires_payment, payment_amount, payment_method, validation_status, status FROM orders WHERE id = ? LIMIT 1', [Number(idOrNumber)]);
    } else {
      rows = await query('SELECT id, order_number, requires_payment, payment_amount, payment_method, validation_status, status FROM orders WHERE order_number = ? LIMIT 1', [idOrNumber]);
    }

    if (!rows.length) {
      console.error('Order not found:', idOrNumber);
      process.exit(1);
    }
    const o = rows[0];
    console.log('Before:', o);

    await query(
      `UPDATE orders
         SET requires_payment = 1,
             payment_amount = ?,
             updated_at = NOW()
       WHERE id = ?`,
      [cashAmount, o.id]
    );

    const after = await query('SELECT id, order_number, requires_payment, payment_amount, payment_method, validation_status, status FROM orders WHERE id = ? LIMIT 1', [o.id]);
    console.log('After:', after[0]);
  } catch (e) {
    console.error('Error:', e && (e.sqlMessage || e.message) || e);
    process.exit(1);
  } finally {
    await poolEnd().catch(() => {});
  }
}

run();
