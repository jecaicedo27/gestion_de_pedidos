// Usage: node scripts/fix_order_payment_to_credit.js FV-2-14749
// Or:    node scripts/fix_order_payment_to_credit.js 14749
const { query, poolEnd } = require('../backend/config/database');

async function main() {
  try {
    const arg = process.argv[2];
    if (!arg) {
      console.error('Provide order number or ID. Example: node scripts/fix_order_payment_to_credit.js FV-2-14749');
      process.exit(1);
    }

    let orders = [];
    if (/^\d+$/.test(arg)) {
      // numeric -> try by id or order_number ending with digits
      orders = await query('SELECT id, order_number, payment_method, status, total_amount FROM orders WHERE id = ? OR order_number LIKE ?', [Number(arg), `%${arg}`]);
    } else {
      orders = await query('SELECT id, order_number, payment_method, status, total_amount FROM orders WHERE order_number = ? OR order_number LIKE ?', [arg, `%${arg}%`]);
    }

    if (!orders.length) {
      console.log('No orders matched for:', arg);
      return;
    }

    for (const o of orders) {
      console.log('Before:', o);
      if ((o.payment_method || '').toLowerCase() !== 'credito') {
        await query('UPDATE orders SET payment_method = ?, updated_at = NOW() WHERE id = ?', ['credito', o.id]);
        const [updated] = await query('SELECT id, order_number, payment_method, status, total_amount FROM orders WHERE id = ?', [o.id]);
        console.log('Updated to credit:', updated);
      } else {
        console.log('Already credit, no update needed for id:', o.id);
      }
    }
  } catch (err) {
    console.error('Error fixing order payment to credit:', err);
    process.exitCode = 1;
  } finally {
    await poolEnd();
  }
}

main();
