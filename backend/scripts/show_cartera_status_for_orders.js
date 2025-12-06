const { query, poolEnd } = require('../config/database');

(async () => {
  const numbers = process.argv.slice(2);
  if (!numbers.length) {
    console.log('Uso: node backend/scripts/show_cartera_status_for_orders.js <ORDER_NUMBER> [<ORDER_NUMBER> ...]');
    console.log('Ejemplo: node backend/scripts/show_cartera_status_for_orders.js FV-2-15021 FV-2-14748');
  }
  try {
    const placeholders = numbers.length ? numbers.map(() => '?').join(',') : '?';
    const params = numbers.length ? numbers : ['FV-2-15021'];
    const rows = await query(
      `SELECT 
         o.order_number,
         o.id AS order_id,
         o.delivery_method,
         o.payment_method,
         cr.status AS cash_status,
         cr.amount,
         cr.created_at,
         cr.accepted_at,
         COALESCE(u.full_name, u.username) AS accepted_by_name,
         u.role AS accepted_by_role
       FROM orders o
       LEFT JOIN cash_register cr ON cr.order_id = o.id
       LEFT JOIN users u ON u.id = cr.accepted_by
       WHERE o.order_number IN (${placeholders})
       ORDER BY o.order_number ASC`,
      params
    );
    console.table(rows);
  } catch (e) {
    console.error('Error:', e.message || e);
  } finally {
    await poolEnd();
  }
})();
