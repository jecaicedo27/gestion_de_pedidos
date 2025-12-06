/**
 * Aplica reconciliación NO DESTRUCTIVA de items de un pedido frente al estado actual de la factura en SIIGO.
 * Respeta el progreso de empaque: marca ítems originales como 'replaced' si ya tienen escaneos
 * y crea nuevos ítems por la cantidad pendiente, o actualiza in-place si no hay escaneos.
 *
 * Uso:
 *   node backend/scripts/apply_siigo_reconciliation.js             # Toma el último pedido en empaque con siigo_invoice_id
 *   node backend/scripts/apply_siigo_reconciliation.js 158         # Con ID de pedido
 *   node backend/scripts/apply_siigo_reconciliation.js FV-2-15319  # Con número de pedido
 */
const { query, transaction } = require('../config/database');
const siigoService = require('../services/siigoService');

function getText(...vals) {
  for (const v of vals) { if (v != null && String(v).trim() !== '') return String(v).trim(); }
  return null;
}

async function findTargetOrder(arg) {
  if (arg) {
    if (/^\d+$/.test(String(arg))) {
      const rows = await query('SELECT id, order_number, status, siigo_invoice_id FROM orders WHERE id = ? LIMIT 1', [Number(arg)]);
      return rows[0] || null;
    } else {
      const rows = await query('SELECT id, order_number, status, siigo_invoice_id FROM orders WHERE order_number = ? LIMIT 1', [String(arg)]);
      return rows[0] || null;
    }
  }
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

async function getPackagingProgress(connection, orderId, itemId) {
  try {
    const [rows] = await connection.execute(
      `SELECT scanned_count, required_scans, is_verified
       FROM packaging_item_verifications
       WHERE order_id = ? AND item_id = ? LIMIT 1`,
      [orderId, itemId]
    );
    if (Array.isArray(rows) && rows.length) {
      return {
        scanned_count: Number(rows[0].scanned_count || 0),
        required_scans: Number(rows[0].required_scans || 0),
        is_verified: Number(rows[0].is_verified || 0)
      };
    }
  } catch (_) {}
  return { scanned_count: 0, required_scans: 0, is_verified: 0 };
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

    console.log(`\n🚀 Aplicando reconciliación para pedido ${order.order_number} (id=${order.id}) - status=${order.status}`);
    console.log(`🔗 SIIGO invoice id: ${order.siigo_invoice_id}`);

    // Obtener factura actual
    const invoice = await siigoService.getInvoiceDetails(order.siigo_invoice_id);
    const incoming = buildIncomingFromInvoice(invoice);

    // Ejecutar dentro de transacción
    await transaction(async (connection) => {
      let anyPackagingChange = false;
      // Determinar si hay progreso de empaque para forzar modo no destructivo
      const packagingStatuses = new Set(['pendiente_empaque', 'en_preparacion', 'en_empaque', 'empacado']);
      let inPackaging = packagingStatuses.has(order.status);
      try {
        const [pv] = await connection.execute(
          'SELECT COUNT(*) AS c FROM packaging_item_verifications WHERE order_id = ? AND (scanned_count > 0 OR COALESCE(packed_quantity,0) > 0 OR is_verified = 1)',
          [order.id]
        );
        if (pv && pv[0] && Number(pv[0].c) > 0) inPackaging = true;
      } catch (_) {}

      // Cargar items existentes
      const [existing] = await connection.execute(
        'SELECT id, name, product_code, invoice_line, quantity, price, description, status FROM order_items WHERE order_id = ?',
        [order.id]
      );

      // Índice de items entrantes (preferencia: invoice_line > product_code > name)
      const incomingByKey = new Map();
      for (const it of incoming) {
        const key = it.invoice_line ? `line:${it.invoice_line}` :
                    (it.product_code ? `code:${it.product_code}` : `name:${it.name}`);
        incomingByKey.set(key, it);
      }

      let updatedInPlace = 0;
      let markedReplaced = 0;
      let createdNew = 0;
      let ensuredVerified = 0;

      const processRow = async (row) => {
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

        if (!matched) {
          // Sin correspondencia exacta. En modo no destructivo no se borra nada.
          return;
        }

        const piv = await getPackagingProgress(connection, order.id, row.id);

        const productChanged =
          (matched.name !== row.name) ||
          ((matched.product_code || null) !== (row.product_code || null));

        if (productChanged) {
          if (piv.scanned_count > 0) {
            const pending = Math.max((matched.quantity || row.quantity) - piv.scanned_count, 0);

            // Marcar original como reemplazado y ajustar cantidad a lo ya escaneado
            await connection.execute(
              `UPDATE order_items 
                 SET status = 'replaced', quantity = ?, updated_at = NOW()
               WHERE id = ?`,
              [piv.scanned_count, row.id]
            );
            markedReplaced++;

            // Asegurar verificación completa del original
            await connection.execute(
              `INSERT INTO packaging_item_verifications 
                 (order_id, item_id, scanned_count, required_scans, is_verified, verified_at, verified_by)
               VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, 'reconciliacion_siigo')
               ON DUPLICATE KEY UPDATE
                 scanned_count = VALUES(scanned_count),
                 required_scans = VALUES(required_scans),
                 is_verified = 1,
                 verified_at = COALESCE(verified_at, CURRENT_TIMESTAMP),
                 updated_at = CURRENT_TIMESTAMP`,
              [order.id, row.id, piv.scanned_count, piv.scanned_count]
            );
            ensuredVerified++;

            // Crear SIEMPRE un ítem nuevo con el producto actualizado por la cantidad total de la línea
            const [insNew2] = await connection.execute(
              `INSERT INTO order_items 
                 (order_id, name, product_code, invoice_line, quantity, price, description, status, replaced_from_item_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, NOW())`,
              [
                order.id,
                matched.name,
                matched.product_code || null,
                matched.invoice_line || null,
                matched.quantity,
                matched.price,
                matched.description || null,
                row.id
              ]
            );
            createdNew++;
            const newItemId2 = insNew2?.insertId;
            if (newItemId2) {
              await connection.execute(
                `INSERT INTO packaging_item_verifications 
                   (order_id, item_id, scanned_count, required_scans, is_verified, verified_by)
                 VALUES (?, ?, 0, ?, 0, 'reconciliacion_siigo_new')
                 ON DUPLICATE KEY UPDATE
                   scanned_count = 0,
                   required_scans = VALUES(required_scans),
                   is_verified = 0,
                   updated_at = CURRENT_TIMESTAMP`,
                [order.id, newItemId2, matched.quantity]
              );
              anyPackagingChange = true;
            }
          } else {
            // Sin escaneos: actualizar in-place
            await connection.execute(
              `UPDATE order_items
                 SET name = ?, product_code = ?, invoice_line = ?, quantity = ?, price = ?, description = ?, status = 'active'
               WHERE id = ?`,
              [
                matched.name,
                matched.product_code || null,
                matched.invoice_line || null,
                matched.quantity,
                matched.price,
                matched.description || null,
                row.id
              ]
            );
            updatedInPlace++;
          }
        } else {
          // Mismo producto
          if (piv.scanned_count === 0) {
            // Cambios de cantidad/precio/linea/descripcion aplican in-place
            await connection.execute(
              `UPDATE order_items
                 SET quantity = ?, price = ?, description = ?, invoice_line = ?
               WHERE id = ?`,
              [
                matched.quantity,
                matched.price,
                matched.description || null,
                matched.invoice_line || null,
                row.id
              ]
            );
            updatedInPlace++;
          } else {
            // Si la cantidad nueva es mayor que lo ya escaneado, dividir
            const pending = Math.max((matched.quantity || row.quantity) - piv.scanned_count, 0);
            if (pending > 0 && matched.quantity !== row.quantity) {
              await connection.execute(
                `UPDATE order_items 
                   SET status = 'replaced', quantity = ?, updated_at = NOW()
                 WHERE id = ?`,
                [piv.scanned_count, row.id]
              );
              markedReplaced++;

              await connection.execute(
                `INSERT INTO packaging_item_verifications 
                   (order_id, item_id, scanned_count, required_scans, is_verified, verified_at, verified_by)
                 VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, 'reconciliacion_siigo')
                 ON DUPLICATE KEY UPDATE
                   scanned_count = VALUES(scanned_count),
                   required_scans = VALUES(required_scans),
                   is_verified = 1,
                   verified_at = COALESCE(verified_at, CURRENT_TIMESTAMP),
                   updated_at = CURRENT_TIMESTAMP`,
                [order.id, row.id, piv.scanned_count, piv.scanned_count]
              );
              ensuredVerified++;

              const [insSplit2] = await connection.execute(
                `INSERT INTO order_items 
                   (order_id, name, product_code, invoice_line, quantity, price, description, status, replaced_from_item_id, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, NOW())`,
                [
                  order.id,
                  matched.name,
                  matched.product_code || row.product_code || null,
                  matched.invoice_line || row.invoice_line || null,
                  pending,
                  matched.price || row.price,
                  matched.description || row.description || null,
                  row.id
                ]
              );
              createdNew++;
              const newSplitItemId2 = insSplit2?.insertId;
              if (newSplitItemId2) {
                await connection.execute(
                  `INSERT INTO packaging_item_verifications 
                     (order_id, item_id, scanned_count, required_scans, is_verified, verified_by)
                   VALUES (?, ?, 0, ?, 0, 'reconciliacion_siigo_split')
                   ON DUPLICATE KEY UPDATE
                     scanned_count = 0,
                     required_scans = VALUES(required_scans),
                     is_verified = 0,
                     updated_at = CURRENT_TIMESTAMP`,
                  [order.id, newSplitItemId2, pending]
                );
                anyPackagingChange = true;
              }
            }
          }
        }

        if (matchedKey) incomingByKey.delete(matchedKey);
      };

      if (!inPackaging) {
        console.log('ℹ️ El pedido no tiene progreso de empaque. No se aplican borrados aquí. Usa /reload-from-siigo vía API para merge completo.');
      }

      for (const row of existing) {
        await processRow(row);
      }

      // Insertar líneas nuevas que no existían
      for (const it of incomingByKey.values()) {
        const [insNewLine2] = await connection.execute(
          `INSERT INTO order_items 
             (order_id, name, product_code, invoice_line, quantity, price, description, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NOW())`,
          [order.id, it.name, it.product_code || null, it.invoice_line || null, it.quantity, it.price, it.description || null]
        );
        createdNew++;
        const newLineId2 = insNewLine2?.insertId;
        if (newLineId2) {
          await connection.execute(
            `INSERT INTO packaging_item_verifications 
               (order_id, item_id, scanned_count, required_scans, is_verified, verified_by)
             VALUES (?, ?, 0, ?, 0, 'reconciliacion_siigo_newline')
             ON DUPLICATE KEY UPDATE
               scanned_count = 0,
               required_scans = VALUES(required_scans),
               is_verified = 0,
               updated_at = CURRENT_TIMESTAMP`,
            [order.id, newLineId2, it.quantity]
          );
          anyPackagingChange = true;
        }
      }

      // Indicar a la UI que el pedido requiere revisión visual (cambios en empaque)
      if (anyPackagingChange) {
        try {
          await connection.execute(
            `UPDATE orders SET packaging_status = 'requires_review', updated_at = NOW() WHERE id = ?`,
            [order.id]
          );
        } catch (_) {}
      }

      console.log('\n✅ Reconciliación aplicada:');
      console.log(` - Actualizados in-place: ${updatedInPlace}`);
      console.log(` - Marcados como replaced: ${markedReplaced}`);
      console.log(` - Nuevos items creados: ${createdNew}`);
      console.log(` - Verificaciones aseguradas como completas: ${ensuredVerified}`);
    });

    console.log('\nSugerencia: valida el checklist de empaque y el conteo/pendientes en la UI. Los ítems con status="replaced" no cuentan como pendientes pero quedan visibles como evidencia.');

    process.exit(0);
  } catch (e) {
    console.error('❌ Error aplicando reconciliación:', e?.message || e);
    process.exit(1);
  }
})();
