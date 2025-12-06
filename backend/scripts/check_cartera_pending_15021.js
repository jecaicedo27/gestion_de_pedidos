/**
 * Verifica si FV-2-15021 aparece en la consulta de pendientes de Cartera (bloque Bodega)
 * Uso: node backend/scripts/check_cartera_pending_15021.js
 */
const { query, poolEnd } = require('../config/database');

async function run() {
  try {
    const [order] = await query(
      `SELECT id, order_number, customer_name, payment_method, delivery_method, siigo_invoice_created_at AS invoice_date
       FROM orders WHERE id = ? OR order_number = ? LIMIT 1`,
      [38, 'FV-2-15021']
    );
    if (!order) {
      console.log('❌ Pedido no encontrado');
      return;
    }
    console.log('Order:', order);

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
         'bodega' AS source
       FROM cash_register cr
       JOIN orders o ON o.id = cr.order_id
       WHERE (cr.status IS NULL OR cr.status <> 'collected') AND cr.order_id = ?
       ORDER BY cr.created_at DESC
       LIMIT 5`,
      [order.id]
    );

    console.log('\nPendientes (bodega) encontrados:', rowsBodega.length);
    rowsBodega.forEach(r => console.log(r));
  } catch (e) {
    console.error('Error:', e.message || e);
  } finally {
    await poolEnd();
  }
}

run();
