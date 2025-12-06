// Inspecta campos de notas/motivo para un pedido (por id o por order_number)
// Uso: node backend/scripts/inspect_special_notes.js 15235
//      node backend/scripts/inspect_special_notes.js FV-2-15235
const { query, poolEnd } = require('../config/database');

function extractSpecialReasonFromNotes(notes) {
  if (!notes) return null;
  const m = /gesti[oó]n especial:\s*(.*)/i.exec(String(notes));
  return (m && m[1]) ? m[1].trim() : null;
}

async function run() {
  const key = process.argv[2];
  if (!key) {
    console.error('Uso: node backend/scripts/inspect_special_notes.js <id o order_number>');
    process.exitCode = 1;
    return;
  }

  try {
    let rows = [];
    if (/^\d+$/.test(key)) {
      // Buscar por id o por coincidencia del order_number con ese número
      rows = await query(
        `SELECT id, order_number, status, special_management_note, notes, siigo_observations, siigo_invoice_number, created_at, updated_at
           FROM orders
          WHERE id = ? OR order_number = ? OR order_number LIKE ?
          ORDER BY id DESC
          LIMIT 5`,
        [Number(key), String(key), '%' + key + '%']
      );
    } else {
      rows = await query(
        `SELECT id, order_number, status, special_management_note, notes, siigo_observations, siigo_invoice_number, created_at, updated_at
           FROM orders
          WHERE order_number = ? OR order_number LIKE ?
          ORDER BY id DESC
          LIMIT 5`,
        [key, '%' + key + '%']
      );
    }

    if (!rows.length) {
      console.log('No se encontraron pedidos para:', key);
      return;
    }

    console.log('Resultados:', rows.length);
    for (const r of rows) {
      const parsed = extractSpecialReasonFromNotes(r.notes);
      console.log('---------------------------------------------');
      console.log('ID:', r.id);
      console.log('Order Number:', r.order_number);
      console.log('Status:', r.status);
      console.log('Nota Gestión Especial (orders.special_management_note):');
      console.log(r.special_management_note || '-');
      console.log('Notas (orders.notes):');
      console.log(r.notes || '-');
      console.log('Motivo (preferido especial_management_note o notes):', (r.special_management_note || parsed || '-'));
      console.log('siigo_observations:');
      console.log(r.siigo_observations || '-');
      console.log('Siigo Invoice:', r.siigo_invoice_number || '-');
      console.log('created_at:', r.created_at);
      console.log('updated_at:', r.updated_at);
    }
  } catch (e) {
    console.error('Error:', e && (e.sqlMessage || e.message) || e);
    process.exitCode = 1;
  } finally {
    await poolEnd().catch(() => {});
  }
}

run();
