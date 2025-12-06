// Lista pedidos pendientes por facturar para diagnóstico rápido
// Usa la conexión de backend/config/database.js

const { query, pool } = require('../config/database');

(async () => {
  try {
    const rows = await query(
      `
      SELECT 
        id, order_number, customer_name, customer_phone, total_amount, payment_method, delivery_method,
        status, created_at, updated_at, siigo_invoice_number
      FROM orders
      WHERE deleted_at IS NULL
        AND status IN ('pendiente_por_facturacion', 'pendiente_facturacion')
      ORDER BY created_at DESC
      LIMIT 20
      `,
      []
    );

    if (!rows.length) {
      console.log('No hay pedidos en pendiente_por_facturacion ni pendiente_facturacion.');
    } else {
      console.log('Pedidos pendientes por facturar (máx 20):');
      rows.forEach(r => {
        console.log(
          [
            `• ${r.order_number || r.id}`,
            `Cliente: ${r.customer_name || '-'}`,
            `Tel: ${r.customer_phone || '-'}`,
            `Monto: $${Number(r.total_amount || 0).toLocaleString('es-CO')}`,
            `Pago: ${r.payment_method || '-'}`,
            `Envio: ${r.delivery_method || '-'}`,
            `Estado: ${r.status}`,
            `Factura SIIGO: ${r.siigo_invoice_number || '-'}`,
            `Creado: ${r.created_at?.toISOString?.() || r.created_at}`
          ].join(' | ')
        );
      });
    }
  } catch (e) {
    console.error('Error listando pendientes por facturar:', e.message);
  } finally {
    try { await pool.end(); } catch (_) {}
  }
})();
