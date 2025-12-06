/**
 * Verifica si una factura (order_number) aparece en los pendientes de Cartera (fuente Bodega)
 * Uso: node backend/scripts/check_cartera_pending_by_number.js FV-2-15021
 */
const { query, poolEnd } = require('../config/database');

async function run() {
  const number = process.argv[2];
  if (!number) {
    console.log('Uso: node backend/scripts/check_cartera_pending_by_number.js <order_number>');
    process.exitCode = 1;
    return;
  }
  try {
    const [order] = await query(
      `SELECT id, order_number, customer_name, payment_method, delivery_method, total_amount, siigo_invoice_created_at AS invoice_date
       FROM orders WHERE order_number = ? ORDER BY id DESC LIMIT 1`,
      [number]
    );
    if (!order) {
      console.log('❌ Pedido no encontrado por número:', number);
      return;
    }
    console.log('Order:', order);

    const cashRows = await query(
      `SELECT id, order_id, amount, payment_method, delivery_method, status, registered_by, accepted_by, created_at, accepted_at
       FROM cash_register
       WHERE order_id = ?
       ORDER BY id DESC`,
      [order.id]
    );
    console.log('\nRegistros en cash_register:', cashRows.length);
    cashRows.forEach(r => console.log(r));

    const rowsBodega = await query(
      `SELECT
         o.id AS order_id,
         o.order_number,
         o.customer_name,
         o.customer_phone,
         o.customer_address,
         o.total_amount,
         o.payment_method,
         o.shipping_payment_method,
         NULL AS messenger_id,
         'Bodega' AS messenger_name,
         cr.created_at AS delivered_at,
         o.siigo_invoice_created_at AS invoice_date,
         0 AS product_collected,
         0 AS delivery_fee_collected,
         COALESCE(cr.amount,0) AS expected_amount,
         NULL AS detail_id,
         COALESCE(cr.accepted_amount,0) AS declared_amount,
         COALESCE(cr.status,'pending') AS collection_status,
         NULL AS closing_id,
         NULL AS closing_date,
         cr.id AS cash_register_id,
         cr.registered_by,
         cr.accepted_by
       FROM cash_register cr
       JOIN orders o ON o.id = cr.order_id
       WHERE (cr.status IS NULL OR cr.status <> 'collected') AND cr.order_id = ?
       ORDER BY cr.created_at DESC
       LIMIT 10`,
      [order.id]
    );

    console.log('\nPendientes (bodega) para esta factura:', rowsBodega.length);
    rowsBodega.forEach(r => console.log(r));
  } catch (e) {
    console.error('Error:', e.message || e);
  } finally {
    await poolEnd();
  }
}

run();
