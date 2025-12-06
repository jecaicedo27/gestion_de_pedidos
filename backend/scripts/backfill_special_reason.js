/**
 * Backfill del motivo de Gestión Especial en orders.special_management_note (nueva columna).
 * - También fuerza el status = 'gestion_especial'
 * - Registra un evento en orders_audit con action='SPECIAL_MANAGED'
 *
 * Uso:
 *   node backend/scripts/backfill_special_reason.js 15235 "INTENTO DE ROBO"
 *   node backend/scripts/backfill_special_reason.js FV-2-15235 "INTENTO DE ROBO"
 */
const { query, transaction, poolEnd } = require('../config/database');

function extractSpecialReasonFromNotes(notes) {
  if (!notes) return null;
  const m = /gesti[oó]n especial:\s*(.*)/i.exec(String(notes));
  return (m && m[1]) ? m[1].trim() : null;
}

async function findOrder(key) {
  if (/^\d+$/.test(key)) {
    // Buscar por id exacto, por order_number exacto y por fragmento
    const rows = await query(
      `SELECT id, order_number, status, special_management_note, notes, siigo_invoice_number, updated_at, created_at
         FROM orders
        WHERE id = ? OR order_number = ? OR order_number LIKE ?
        ORDER BY id DESC
        LIMIT 1`,
      [Number(key), String(key), '%' + key + '%']
    );
    return rows[0] || null;
  } else {
    const rows = await query(
      `SELECT id, order_number, status, special_management_note, notes, siigo_invoice_number, updated_at, created_at
         FROM orders
        WHERE order_number = ? OR order_number LIKE ?
        ORDER BY id DESC
        LIMIT 1`,
      [key, '%' + key + '%']
    );
    return rows[0] || null;
  }
}

function buildNewNotes(currentNotes, reason) {
  const clean = (s) => (s == null ? '' : String(s));
  const existing = clean(currentNotes);
  const already = extractSpecialReasonFromNotes(existing);

  if (already && already.toLowerCase() === String(reason).trim().toLowerCase()) {
    // Ya está el mismo motivo; devolver igual para no duplicar
    return existing;
  }

  const prefix = 'GESTIÓN ESPECIAL: ';
  const line = prefix + String(reason).trim();

  // Si ya hay una línea de gestión especial, reemplazar su contenido
  if (already) {
    return existing.replace(/gesti[oó]n especial:\s*.*$/im, line);
  }

  // Añadir nueva línea al final, separando con un salto si hace falta
  if (!existing) return line;
  const needsNewline = /\S$/.test(existing);
  return existing + (needsNewline ? '\n' : '') + line;
}

async function run() {
  const key = process.argv[2];
  const reason = process.argv[3];

  if (!key || !reason || String(reason).trim().length < 3) {
    console.error('Uso: node backend/scripts/backfill_special_reason.js <id|order_number> "<motivo mínimo 3 caracteres>"');
    process.exitCode = 1;
    return;
  }

  try {
    const order = await findOrder(key);
    if (!order) {
      console.error('No se encontró pedido para:', key);
      process.exitCode = 1;
      return;
    }

    console.log('Pedido encontrado:', { id: order.id, number: order.order_number, status: order.status });

    const specialNote = String(reason).trim();

    await transaction(async (connection) => {
      // Actualizar pedido
      await connection.execute(
        'UPDATE orders SET status = ?, special_management_note = ?, updated_at = NOW() WHERE id = ?',
        ['gestion_especial', specialNote, order.id]
      );

      // Registrar en auditoría similar al controlador (usa customer_name para almacenar motivo)
      try {
        await connection.execute(
          `INSERT INTO orders_audit (order_id, action, siigo_invoice_number, customer_name, user_id, created_at)
           VALUES (?, 'SPECIAL_MANAGED', ?, ?, ?, NOW())`,
          [order.id, order.siigo_invoice_number || null, String(reason).trim(), null]
        );
      } catch (e) {
        console.warn('No se pudo registrar en orders_audit:', e.message);
      }
    });

    // Verificación final
    const final = await query('SELECT id, order_number, status, special_management_note, updated_at FROM orders WHERE id = ?', [order.id]);
    const f = final[0] || {};
    console.log('--- Resultado ---');
    console.log('ID:', f.id);
    console.log('Order Number:', f.order_number);
    console.log('Status:', f.status);
    console.log('Nota Gestión Especial (orders.special_management_note):');
    console.log(f.special_management_note || '-');
    console.log('Motivo detectado:', f.special_management_note || '-');
    console.log('updated_at:', f.updated_at);
    console.log('✔ Backfill completado.');
  } catch (e) {
    console.error('Error:', e && (e.sqlMessage || e.message) || e);
    process.exitCode = 1;
  } finally {
    await poolEnd().catch(() => {});
  }
}

run();
