/**
 * Preview de reconciliación no destructiva de items cuando la factura SIIGO cambia
 * sabores/presentaciones/productos sin alterar la cantidad total.
 *
 * NO aplica cambios en BD. Solo imprime el plan de acciones.
 *
 * Uso:
 *   node backend/scripts/preview_siigo_reconciliation.js             # Toma el último pedido en empaque
 *   node backend/scripts/preview_siigo_reconciliation.js 12345       # Con ID de pedido específico
 *   node backend/scripts/preview_siigo_reconciliation.js ORD-15234   # Con número de pedido
 */
const { query } = require('../config/database');
const siigoService = require('../services/siigoService');

function getText(...vals) {
  for (const v of vals) { if (v != null && String(v).trim() !== '') return String(v).trim(); }
  return null;
}

async function findTargetOrder(arg) {
  if (arg) {
    // Buscar por ID numérico o número de pedido
    if (/^\d+$/.test(String(arg))) {
      const rows = await query('SELECT id, order_number, status, siigo_invoice_id FROM orders WHERE id = ? LIMIT 1', [Number(arg)]);
      return rows[0] || null;
    } else {
      const rows = await query('SELECT id, order_number, status, siigo_invoice_id FROM orders WHERE order_number = ? LIMIT 1', [String(arg)]);
      return rows[0] || null;
    }
  }
  // Elegir el más reciente en etapa de empaque con siigo_invoice_id
  const rows = await query(`
    SELECT id, order_number, status, siigo_invoice_id
    FROM orders
    WHERE status IN ('pendiente_empaque','en_preparacion','en_empaque','empacado')
      AND siigo_invoice_id IS NOT NULL
    ORDER BY updated_at DESC, id DESC
    LIMIT 1
  `);
  return rows[0] || null;
}

async function getPackagingProgress(orderId, itemId) {
  const rows = await query(
    `SELECT scanned_count, required_scans, is_verified
     FROM packaging_item_verifications
     WHERE order_id = ? AND item_id = ? LIMIT 1`,
    [orderId, itemId]
  );
  if (!rows.length) return { scanned_count: 0, required_scans: 0, is_verified: 0 };
  return {
    scanned_count: Number(rows[0].scanned_count || 0),
    required_scans: Number(rows[0].required_scans || 0),
    is_verified: Number(rows[0].is_verified || 0)
  };
}

function buildIncomingFromInvoice(invoice) {
  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  return items.map((it, idx) => ({
    name: getText(it?.description, it?.name, 'Producto SIIGO'),
    quantity: Number(it?.quantity || 1),
    price: Number(it?.price || it?.unit_price || 0),
    description: getText(it?.description, it?.name),
    product_code: getText(it?.code, it?.product?.code),
    invoice_line: Number(idx + 1)
  }));
}

(async () => {
  try {
    const arg = process.argv[2] || null;
    const order = await findTargetOrder(arg);
    if (!order) {
      console.log('❌ No se encontró pedido candidato. Proporcione /:id o número de pedido.');
      process.exit(1);
    }
    if (!order.siigo_invoice_id) {
      console.log(`❌ Pedido ${order.order_number} (id=${order.id}) no tiene siigo_invoice_id.`);
      process.exit(1);
    }

    console.log(`\n🧪 Preview reconciliación para pedido ${order.order_number} (id=${order.id}) - status=${order.status}`);
    console.log(`🔗 SIIGO invoice id: ${order.siigo_invoice_id}`);

    // Traer factura actual de SIIGO
    const invoice = await siigoService.getInvoiceDetails(order.siigo_invoice_id);
    const incoming = buildIncomingFromInvoice(invoice);

    // Cargar items actuales
    const existing = await query(
      'SELECT id, name, product_code, invoice_line, quantity, price, description, status FROM order_items WHERE order_id = ?',
      [order.id]
    );

    // Construir índice de incoming por prioridad: invoice_line > product_code > name
    const incomingByKey = new Map();
    for (const it of incoming) {
      const key = it.invoice_line ? `line:${it.invoice_line}` :
                  (it.product_code ? `code:${it.product_code}` : `name:${it.name}`);
      incomingByKey.set(key, it);
    }

    const actions = [];

    for (const row of existing) {
      const keysToTry = [];
      if (row.invoice_line) keysToTry.push(`line:${row.invoice_line}`);
      if (row.product_code) keysToTry.push(`code:${row.product_code}`);
      keysToTry.push(`name:${row.name}`);

      let matched = null;
      let matchedKey = null;
      for (const k of keysToTry) {
        if (incomingByKey.has(k)) {
          matched = incomingByKey.get(k);
          matchedKey = k;
          break;
        }
      }

      // Obtener progreso de escaneo
      const piv = await getPackagingProgress(order.id, row.id);

      if (!matched) {
        actions.push({
          type: 'no-longer-in-invoice',
          item_id: row.id,
          item_name: row.name,
          product_code: row.product_code || null,
          current_quantity: row.quantity,
          scanned_count: piv.scanned_count,
          note: 'Sin match directo en factura (se mantiene en empaque si ya escaneado; fuera de empaque se eliminaría).'
        });
        continue;
      }

      const productChanged = (matched.name !== row.name) ||
                             ((matched.product_code || null) !== (row.product_code || null));

      if (productChanged) {
        if (piv.scanned_count > 0) {
          const pending = Math.max((matched.quantity || row.quantity) - piv.scanned_count, 0);
          actions.push({
            type: 'replace-with-new',
            reason: 'product_changed_with_scans',
            original_item_id: row.id,
            original_name: row.name,
            original_code: row.product_code || null,
            scanned_count: piv.scanned_count,
            will_mark_original_as: 'replaced',
            new_item: pending > 0 ? {
              name: matched.name,
              product_code: matched.product_code || null,
              invoice_line: matched.invoice_line || null,
              quantity: pending,
              price: matched.price,
              description: matched.description || null
            } : null
          });
        } else {
          actions.push({
            type: 'update-in-place',
            reason: 'product_changed_without_scans',
            item_id: row.id,
            from: { name: row.name, code: row.product_code || null, qty: row.quantity, price: row.price },
            to:   { name: matched.name, code: matched.product_code || null, qty: matched.quantity, price: matched.price, invoice_line: matched.invoice_line || null }
          });
        }
      } else {
        if (piv.scanned_count === 0) {
          if (matched.quantity !== row.quantity || matched.price !== row.price || (matched.invoice_line || null) !== (row.invoice_line || null) || (matched.description || null) !== (row.description || null)) {
            actions.push({
              type: 'update-in-place',
              reason: 'quantity/price/desc/line_changed_no_scans',
              item_id: row.id,
              from: { qty: row.quantity, price: row.price, invoice_line: row.invoice_line || null, description: row.description || null },
              to:   { qty: matched.quantity, price: matched.price, invoice_line: matched.invoice_line || null, description: matched.description || null }
            });
          } else {
            actions.push({
              type: 'no-change',
              item_id: row.id,
              item_name: row.name
            });
          }
        } else {
          const pending = Math.max((matched.quantity || row.quantity) - piv.scanned_count, 0);
          if (pending > 0 && matched.quantity !== row.quantity) {
            actions.push({
              type: 'split-quantity',
              reason: 'quantity_increased_with_scans',
              original_item_id: row.id,
              scanned_count: piv.scanned_count,
              will_mark_original_as: 'replaced',
              new_item: {
                name: matched.name,
                product_code: matched.product_code || row.product_code || null,
                invoice_line: matched.invoice_line || row.invoice_line || null,
                quantity: pending,
                price: matched.price || row.price,
                description: matched.description || row.description || null
              }
            });
          } else {
            actions.push({
              type: 'no-change',
              item_id: row.id,
              item_name: row.name,
              note: 'Producto igual; escaneo ya en progreso/completo'
            });
          }
        }
      }

      if (matchedKey) incomingByKey.delete(matchedKey);
    }

    // Items nuevos en factura que no estaban en el pedido (en empaque: insertar nuevos)
    for (const it of incomingByKey.values()) {
      actions.push({
        type: 'insert-new',
        name: it.name,
        product_code: it.product_code || null,
        invoice_line: it.invoice_line || null,
        quantity: it.quantity,
        price: it.price,
        description: it.description || null
      });
    }

    console.log('\n=== PLAN DE RECONCILIACIÓN (PREVIEW, sin aplicar) ===');
    if (actions.length === 0) {
      console.log('No se detectaron cambios.');
    } else {
      for (const [idx, act] of actions.entries()) {
        console.log(`${idx + 1}.`, JSON.stringify(act, null, 2));
      }
    }

    console.log('\nConsejo: Para aplicar en caliente, usar desde UI el botón de recarga de SIIGO (POST /api/orders/:id/reload-from-siigo).');
    console.log('El backend ya implementa reconciliación no destructiva en etapa de empaque.');

    process.exit(0);
  } catch (e) {
    console.error('❌ Error en preview:', e?.message || e);
    process.exit(1);
  }
})();
