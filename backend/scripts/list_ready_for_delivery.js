/**
 * Lista los pedidos con status = 'listo_para_entrega'
 * Uso: node backend/scripts/list_ready_for_delivery.js
 */
const { query } = require('../config/database');

(async () => {
  try {
    const rows = await query(
      `SELECT 
         id, order_number, customer_name, customer_phone, customer_address,
         delivery_method, carrier_id, assigned_messenger_id, messenger_status,
         payment_method, requires_payment, created_at, updated_at
       FROM orders 
       WHERE deleted_at IS NULL AND status = 'listo_para_entrega'
       ORDER BY created_at ASC`,
      []
    );

    const count = rows.length;
    const pickups = rows.filter(r => String(r.delivery_method || '').toLowerCase().includes('recoge'));
    const withMessenger = rows.filter(r => r.assigned_messenger_id != null);
    const withoutMessenger = rows.filter(r => r.assigned_messenger_id == null);

    console.log('READY_FOR_DELIVERY_COUNT =', count);
    console.log('  - Recoge en Bodega/Tienda:', pickups.length);
    console.log('  - Con mensajero asignado :', withMessenger.length);
    console.log('  - Sin mensajero          :', withoutMessenger.length);
    console.log('DETALLE (id, order_number, customer_name, delivery_method, assigned_messenger_id):');
    for (const r of rows) {
      console.log(
        `${r.id}\t${r.order_number}\t${r.customer_name}\t${r.delivery_method || '-'}\t${r.assigned_messenger_id ?? '-'}`
      );
    }
    process.exit(0);
  } catch (e) {
    console.error('ERROR list_ready_for_delivery:', e && (e.sqlMessage || e.message) || e);
    process.exit(1);
  }
})();
