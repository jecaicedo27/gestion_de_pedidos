/**
 * Importa en bloque todas las facturas SIIGO no importadas desde una fecha de inicio.
 * Uso:
 *   node backend/scripts/import_missing_from_siigo.js                # usa fecha de inicio de system_config
 *   node backend/scripts/import_missing_from_siigo.js 2025-11-10     # fecha explícita (YYYY-MM-DD)
 */
const axios = require('axios');
const { query, poolEnd } = require('../config/database');

async function getStartDate(cliArg) {
  if (cliArg && /^\d{4}-\d{2}-\d{2}$/.test(cliArg)) return cliArg;
  try {
    const resp = await axios.get('http://127.0.0.1/api/system-config/siigo-start-date', { timeout: 10000 });
    const enabled = !!resp?.data?.data?.enabled;
    const start = resp?.data?.data?.start_date;
    if (enabled && start) return start;
  } catch (_) {}
  // fallback: ayer
  return new Date(Date.now() - 24*60*60*1000).toISOString().split('T')[0];
}

async function fetchInvoices(start) {
  const url = `http://127.0.0.1/api/siigo/invoices?start_date=${start}&page_size=200`;
  const resp = await axios.get(url, { timeout: 180000 });
  return resp?.data?.data?.results || [];
}

async function alreadyImported(id) {
  const rows = await query('SELECT id FROM orders WHERE siigo_invoice_id = ? LIMIT 1', [id]);
  return rows.length > 0 ? rows[0].id : null;
}

async function importBatch(ids) {
  if (!ids.length) return { success: 0, failed: 0, results: [] };
  try {
    const resp = await axios.post('http://127.0.0.1/api/siigo/import', {
      invoice_ids: ids,
      payment_method: 'auto',
      delivery_method: 'domicilio'
    }, { timeout: 180000 });
    const results = resp?.data?.results || [];
    return {
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  } catch (e) {
    return { success: 0, failed: ids.length, results: ids.map(id => ({ invoiceId: id, success: false, message: e.response?.data?.message || e.message })) };
  }
}

async function run() {
  const start = await getStartDate(process.argv[2]);
  console.log('🗓️  Importación masiva desde:', start);

  const invoices = await fetchInvoices(start);
  console.log('📋 Facturas obtenidas del backend:', invoices.length);

  // Seleccionar sólo no importadas: import_status !== 'imported' y además verificar en BD por si el flag vino desfasado
  const candidates = [];
  for (const inv of invoices) {
    const id = inv.id;
    if (!id) continue;
    const isImportedFlag = inv.is_imported || inv.import_status === 'imported';
    if (!isImportedFlag) {
      const exists = await alreadyImported(id);
      if (!exists) candidates.push(id);
    }
  }

  console.log('✅ Pendientes a importar:', candidates.length);
  const chunkSize = 10;
  let ok = 0, fail = 0;
  const errors = [];
  for (let i = 0; i < candidates.length; i += chunkSize) {
    const chunk = candidates.slice(i, i + chunkSize);
    const res = await importBatch(chunk);
    ok += res.success;
    fail += res.failed;
    for (const r of res.results) {
      if (!r.success) errors.push({ invoiceId: r.invoiceId, message: r.message });
    }
    // pequeña pausa entre lotes para no saturar
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('📊 Resumen importación:', { total: candidates.length, ok, fail });
  if (errors.length) {
    console.log('❌ Errores:');
    for (const e of errors.slice(0, 30)) console.log('-', e.invoiceId, e.message);
  }

  await poolEnd().catch(()=>{});
}

run().catch(async (e) => {
  console.error('❌ Error en importación masiva:', e.message);
  await poolEnd().catch(()=>{});
  process.exit(1);
});
