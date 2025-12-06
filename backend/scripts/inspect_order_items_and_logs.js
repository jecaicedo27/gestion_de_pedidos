/**
 * Inspecciona items y logs de sincronización para un pedido dado por id u order_number (o fragmento).
 * Uso:
 *   node backend/scripts/inspect_order_items_and_logs.js 15249
 *   node backend/scripts/inspect_order_items_and_logs.js FV-2-15249
 */
const { query, poolEnd } = require('../config/database');

async function findOrder(key) {
  if (/^\d+$/.test(key)) {
    // Si es numérico: buscar por id, exacto order_number y LIKE fragment
    const rows = await query(
      `SELECT id, order_number, siigo_invoice_id, siigo_invoice_number, status, delivery_method, payment_method, total_amount, created_at
         FROM orders
        WHERE id = ? OR order_number = ? OR order_number LIKE ?
        ORDER BY id DESC
        LIMIT 1`,
      [Number(key), String(key), '%' + key + '%']
    );
    return rows[0] || null;
  } else {
    const rows = await query(
      `SELECT id, order_number, siigo_invoice_id, siigo_invoice_number, status, delivery_method, payment_method, total_amount, created_at
         FROM orders
        WHERE order_number = ? OR order_number LIKE ?
        ORDER BY id DESC
        LIMIT 1`,
      [key, '%' + key + '%']
    );
    return rows[0] || null;
  }
}

async function run() {
  const key = process.argv[2];
  if (!key) {
    console.error('Uso: node backend/scripts/inspect_order_items_and_logs.js <order_number|fragment|id>');
    process.exit(1);
  }

  try {
    const order = await findOrder(key);
    if (!order) {
      console.log('❌ No se encontró pedido para:', key);
      return;
    }
    console.log('🧾 Pedido:', order);

    const items = await query(
      `SELECT id, order_id, product_code, name, quantity, price, created_at
         FROM order_items
        WHERE order_id = ?
        ORDER BY id ASC`,
      [order.id]
    );
    console.log(`📦 Items (${items.length}):`);
    if (items.length > 0) {
      items.forEach((it) => console.log(it));
    }

    const logs = await query(
      `SELECT id, siigo_invoice_id, sync_status, COALESCE(error_message,'') AS error_message, order_id,
              DATE_FORMAT(processed_at, '%Y-%m-%d %H:%i:%s') AS processed_at
         FROM siigo_sync_log
        WHERE siigo_invoice_id = ?
        ORDER BY id DESC
        LIMIT 20`,
      [order.siigo_invoice_id]
    );
    console.log(`📝 Últimos logs de sincronización para factura ${order.siigo_invoice_id} (${logs.length}):`);
    logs.forEach((l) => console.log(l));

    // También mostrar conteo rápido por si hay 0 ítems
    if (items.length === 0) {
      console.log('⚠️ Pedido con 0 ítems actualmente. Revisar si hay logs "pending_no_items" o errores de inserción.');
    }
  } catch (e) {
    console.error('❌ Error inspeccionando pedido:', e && (e.sqlMessage || e.message) || e);
    process.exitCode = 1;
  } finally {
    await poolEnd().catch(() => {});
  }
}

run();
