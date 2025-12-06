/**
 * Diagnostica por qué una factura SIIGO no se importó y opcionalmente intenta importarla.
 * Uso:
 *   node backend/scripts/diagnose_siigo_invoice.js 14989
 *   node backend/scripts/diagnose_siigo_invoice.js FV-2-14989
 */
const axios = require('axios');
const { query, poolEnd } = require('../config/database');

async function getStartDate() {
  try {
    const resp = await axios.get('http://127.0.0.1/api/system-config/siigo-start-date', { timeout: 10000 });
    return resp?.data?.data?.start_date || new Date(Date.now() - 24*60*60*1000).toISOString().split('T')[0];
  } catch (_) {
    return new Date(Date.now() - 24*60*60*1000).toISOString().split('T')[0];
  }
}

async function run() {
  const key = process.argv[2];
  if (!key) {
    console.error('Uso: node backend/scripts/diagnose_siigo_invoice.js <numero|FV-2-numero>');
    process.exit(1);
  }
  const num = key.replace(/^FV-2-/i,'');
  const name = key.startsWith('FV-2-') ? key : `FV-2-${num}`;
  const start = await getStartDate();
  console.log('🔎 Diagnóstico de factura:', { name, num, start });

  let found = null;
  try {
    const url = `http://127.0.0.1/api/siigo/invoices?start_date=${start}&page_size=300`;
    const resp = await axios.get(url, { timeout: 180000 });
    const list = resp?.data?.data?.results || [];
    found = list.find(inv => String(inv.number) === String(num) || String(inv.name) === String(name));
    console.log('📋 Total facturas recibidas:', list.length);
    if (found) {
      console.log('✅ Factura encontrada en listado:', {
        id: found.id, name: found.name, number: found.number,
        date: found.date, created: found.created
      });
    } else {
      console.log('❌ No se encontró la factura en el listado de /siigo/invoices');
    }
  } catch (e) {
    console.error('Error consultando /siigo/invoices:', e.message);
  }

  const id = found?.id;
  if (!id) {
    console.log('⏭️  No hay ID para continuar con revisión en BD.');
    return;
  }

  try {
    const [orders] = await query("SELECT COUNT(*) AS c FROM orders WHERE siigo_invoice_id = ?", [id]);
    console.log('🗄️  Pedidos existentes con este siigo_invoice_id:', orders?.c ?? '(desconocido)');

    const logs = await query(
      "SELECT siigo_invoice_id, sync_status, COALESCE(error_message, '') AS err, order_id, DATE_FORMAT(processed_at, '%Y-%m-%d %H:%i:%s') AS ts FROM siigo_sync_log WHERE siigo_invoice_id = ? ORDER BY id DESC LIMIT 10",
      [id]
    );
    console.log('📝 Últimos logs de sincronización:');
    for (const l of logs) console.log(l);
  } catch (e) {
    console.error('Error consultando BD:', e.message);
  }

  try {
    console.log('⬇️  Intentando importación aislada...');
    const resp = await axios.post('http://127.0.0.1/api/siigo/import', {
      invoice_ids: [id],
      payment_method: 'auto',
      delivery_method: 'domicilio'
    }, { timeout: 180000 });
    console.log('🔁 Respuesta importación:', resp.data);
  } catch (e) {
    console.error('❌ Error en importación aislada:', e.response?.data || e.message);
  } finally {
    await poolEnd().catch(()=>{});
  }
}

run();
