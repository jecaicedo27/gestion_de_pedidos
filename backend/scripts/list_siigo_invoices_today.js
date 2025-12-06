#!/usr/bin/env node
/**
 * Lista facturas SIIGO de hoy (creadas hoy).
 * Uso: node backend/scripts/list_siigo_invoices_today.js [page_size=20] [max_pages=2]
 * Por defecto: page_size=20, max_pages=2 (para no golpear rate limit).
 */
const siigoService = require('../services/siigoService');

function ymdTodayUTC() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function extractCustomerName(cust = {}) {
  try {
    if (cust.commercial_name && cust.commercial_name !== 'No aplica') return cust.commercial_name;
    if (cust.company?.name) return cust.company.name;
    if (Array.isArray(cust.name) && cust.name.length) return cust.name.join(' ');
    if (cust.person?.first_name) return `${cust.person.first_name} ${cust.person.last_name || ''}`.trim();
    return cust.identification?.name || cust.name || 'Cliente SIIGO';
  } catch {
    return 'Cliente SIIGO';
  }
}

(async () => {
  try {
    const pageSize = Math.max(1, Math.min(100, parseInt(process.argv[2] || '20', 10)));
    const maxPages = Math.max(1, Math.min(5, parseInt(process.argv[3] || '2', 10)));
    const createdStart = ymdTodayUTC();

    console.log(`🔎 Consultando facturas SIIGO de hoy (created_start=${createdStart}) page_size=${pageSize} max_pages=${maxPages}`);
    let accumulated = [];
    let totalResults = 0;
    let totalPages = 1;

    for (let p = 1; p <= maxPages && p <= totalPages; p++) {
      const t0 = Date.now();
      const data = await siigoService.getInvoices({
        page: p,
        page_size: pageSize,
        created_start: createdStart
      });
      const dt = Date.now() - t0;

      const results = Array.isArray(data?.results) ? data.results : [];
      totalResults = parseInt(data?.pagination?.total_results || (totalResults || results.length), 10) || results.length;
      totalPages = Math.max(1, parseInt(data?.pagination?.total_pages || Math.ceil(totalResults / pageSize), 10));

      console.log(`✅ Página ${p}/${totalPages} — ${results.length} recibidas en ${dt}ms`);

      accumulated.push(...results);

      // Si no hay más resultados, romper
      if (!results.length) break;
    }

    console.log(`📊 Total informados por SIIGO (hoy): ${totalResults}`);
    console.log(`📦 Acumuladas en esta ejecución: ${accumulated.length}`);

    const sample = accumulated.slice(0, Math.min(20, accumulated.length));
    if (sample.length === 0) {
      console.log('ℹ️ No hay facturas hoy.');
    } else {
      console.log('— Facturas (primeras):');
      for (const inv of sample) {
        const name = inv?.name || inv?.number || inv?.id?.slice?.(-8) || 'Factura';
        const date = inv?.date || inv?.created || '';
        const total = inv?.total ?? inv?.total_amount ?? 0;
        const customer = extractCustomerName(inv?.customer || inv?.client || {});
        console.log(`  • ${name} | ${customer} | ${date} | total=${total}`);
      }
    }

    process.exit(0);
  } catch (err) {
    const msg = err?.response?.data || err?.message || String(err);
    const status = err?.response?.status;
    if (status === 429) {
      console.error('⛔ Rate limit SIIGO (429). Intenta en unos minutos.');
      process.exit(2);
    }
    if (status === 401) {
      console.error('🔒 Error de autenticación SIIGO (401). Verifica credenciales.');
      process.exit(3);
    }
    console.error('❌ Error listando facturas de hoy:', msg);
    process.exit(1);
  }
})();
