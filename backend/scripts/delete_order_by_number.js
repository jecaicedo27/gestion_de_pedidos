"use strict";

const { query, poolEnd } = require('../config/database');

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Uso: node backend/scripts/delete_order_by_number.js <orderNumber|orderId>');
    process.exit(1);
  }

  try {
    let rows;
    if (/^\\d+$/.test(String(arg))) {
      rows = await query('SELECT id, order_number, siigo_invoice_id FROM orders WHERE id = ? LIMIT 1', [Number(arg)]);
    } else {
      rows = await query('SELECT id, order_number, siigo_invoice_id FROM orders WHERE order_number = ? LIMIT 1', [arg]);
    }

    if (!rows || !rows.length) {
      console.log('No se encontró el pedido con identificador:', arg);
      return;
    }

    const order = rows[0];
    const id = order.id;
    const orderNumber = order.order_number;
    const siigoInvoiceId = order.siigo_invoice_id || null;

    console.log('🗑️ Eliminando pedido', orderNumber, '(ID', id + ')');

    // Tablas dependientes por order_id (algunas pueden no existir en ciertos entornos)
    const tablesByOrderId = [
      'order_items',
      'delivery_tracking',
      'cash_register',
      'wallet_validations',
      'order_packaging_status',
      'packaging_item_verifications',
      'packaging_records',
      'packaging_evidence',
      'barcode_scan_logs',
      'simple_barcode_scans',
      'shipping_guides',
      'logistics_records',
      'whatsapp_notifications',
      'cash_closing_details'
    ];

    for (const t of tablesByOrderId) {
      try {
        await query(`DELETE FROM ${t} WHERE order_id = ?`, [id]);
        console.log(` - ${t}: OK`);
      } catch (e) {
        console.log(` - ${t}: ${e.message}`);
      }
    }

    // Intento de limpieza de logs de siigo por invoice_id si aplica (columna suele llamarse invoice_id)
    if (siigoInvoiceId) {
      try {
        await query('DELETE FROM siigo_sync_log WHERE invoice_id = ?', [siigoInvoiceId]);
        console.log(' - siigo_sync_log (invoice_id): OK');
      } catch (e) {
        console.log(' - siigo_sync_log (invoice_id):', e.message);
      }
    }

    // Finalmente eliminar el pedido principal
    try {
      await query('DELETE FROM orders WHERE id = ? LIMIT 1', [id]);
      console.log(' - orders: OK');
    } catch (e) {
      console.log(' - orders:', e.message);
    }

    console.log('✅ Eliminación completa para', orderNumber);
  } catch (err) {
    console.error('❌ Error:', err && err.message ? err.message : err);
  } finally {
    try { await poolEnd(); } catch (_) {}
  }
}

main();
