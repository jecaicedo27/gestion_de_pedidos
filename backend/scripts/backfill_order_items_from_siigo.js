/**
 * Backfill de items para un pedido existente desde la factura de SIIGO.
 * Uso:
 *   node backend/scripts/backfill_order_items_from_siigo.js 15249
 *   node backend/scripts/backfill_order_items_from_siigo.js FV-2-15249
 *   node backend/scripts/backfill_order_items_from_siigo.js --id 78
 */
const { query, poolEnd } = require('../config/database');
const siigoService = require('../services/siigoService');

function parseArgs() {
  const args = process.argv.slice(2);
  const res = { key: null, byId: false };
  if (!args.length) return res;
  if (args[0] === '--id') {
    res.byId = true;
    res.key = args[1];
  } else {
    res.key = args[0];
  }
  return res;
}

async function findOrder({ key, byId }) {
  if (byId) {
    const rows = await query(
      `SELECT id, order_number, siigo_invoice_id, status, total_amount 
         FROM orders WHERE id = ? LIMIT 1`,
      [Number(key)]
    );
    return rows[0] || null;
  }
  if (/^\d+$/.test(key)) {
    // Buscar por id numérico, order_number exacto y LIKE fragment
    const rows = await query(
      `SELECT id, order_number, siigo_invoice_id, status, total_amount
         FROM orders
        WHERE id = ? OR order_number = ? OR order_number LIKE ?
        ORDER BY id DESC LIMIT 1`,
      [Number(key), String(key), `%${key}%`]
    );
    return rows[0] || null;
  } else {
    const rows = await query(
      `SELECT id, order_number, siigo_invoice_id, status, total_amount
         FROM orders
        WHERE order_number = ? OR order_number LIKE ?
        ORDER BY id DESC LIMIT 1`,
      [key, `%${key}%`]
    );
    return rows[0] || null;
  }
}

function sanitizeText(text) {
  if (!text || typeof text !== 'string') return text || null;
  return text
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[\uD800-\uDFFF]/g, '')
    .replace(/[^\u0000-\uFFFF]/g, '')
    .trim()
    .slice(0, 255);
}

async function run() {
  const { key, byId } = parseArgs();
  if (!key) {
    console.error('Uso: node backend/scripts/backfill_order_items_from_siigo.js <order_number|fragment|--id ID>');
    process.exit(1);
  }

  try {
    const order = await findOrder({ key, byId });
    if (!order) {
      console.log('❌ No se encontró pedido para:', key);
      return;
    }
    console.log('🧾 Pedido encontrado:', order);

    if (!order.siigo_invoice_id) {
      console.log('❌ El pedido no tiene siigo_invoice_id asociado. Abortando.');
      return;
    }

    console.log(`📄 Obteniendo detalles de factura SIIGO: ${order.siigo_invoice_id}`);
    let fullInvoice = await siigoService.getInvoiceDetails(order.siigo_invoice_id);

    // Reintentos cortos si viene sin items
    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts && (!fullInvoice.items || fullInvoice.items.length === 0)) {
      attempts++;
      console.warn(`⚠️ Factura sin items (intento ${attempts}/${maxAttempts}). Reintentando...`);
      await new Promise((r) => setTimeout(r, Math.min(3000, attempts * 1500)));
      try {
        fullInvoice = await siigoService.getInvoiceDetails(order.siigo_invoice_id);
      } catch (e) {
        console.warn(`Reintento ${attempts} falló: ${e.message}`);
      }
    }

    const items = Array.isArray(fullInvoice.items) ? fullInvoice.items : [];
    console.log(`📦 Items recibidos desde SIIGO: ${items.length}`);

    // Limpiar items actuales
    console.log('🧹 Eliminando items existentes del pedido...');
    await query('DELETE FROM order_items WHERE order_id = ?', [order.id]);

    if (items.length === 0) {
      console.log('⚠️ La factura continúa sin items. No se insertaron registros.');
      return;
    }

    let inserted = 0;
    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      try {
        const invoiceLine = idx + 1;
        const productCode = it.code || (it.product && it.product.code) || null;

        await query(
          `INSERT INTO order_items
             (order_id, name, product_code, quantity, price, description, invoice_line, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            order.id,
            sanitizeText(it.description || it.name || 'Producto SIIGO'),
            sanitizeText(productCode || null),
            parseFloat(it.quantity || 1),
            parseFloat(it.price || it.unit_price || 0),
            sanitizeText(it.description || it.name || null),
            invoiceLine,
          ]
        );
        inserted++;
      } catch (e) {
        console.error(`❌ Error insertando item línea ${idx + 1}:`, e.sqlMessage || e.message || e);
      }
    }

    console.log(`✅ Insertados ${inserted}/${items.length} items para el pedido ${order.id}`);

    // Log opcional de reparación
    try {
      await query(
        `INSERT INTO siigo_sync_log (siigo_invoice_id, order_id, sync_type, sync_status, error_message, processed_at)
         VALUES (?, ?, 'update', ?, '', NOW())`,
        [order.siigo_invoice_id, order.id, inserted > 0 ? 'updated' : 'error']
      );
    } catch (_) {}

    console.log('🎉 Backfill completado.');
  } catch (e) {
    console.error('❌ Error en backfill:', e.sqlMessage || e.message || e);
    process.exitCode = 1;
  } finally {
    await poolEnd().catch(() => {});
  }
}

run();
