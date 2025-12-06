#!/usr/bin/env node
/**
 * Pequeña validación de disponibilidad SIIGO y consulta de cliente por identificación.
 * Uso: node backend/scripts/check_siigo_customer_by_identification.js 1082746400
 */
const axios = require('axios');
const siigoService = require('../services/siigoService');

async function main() {
  const id = (process.argv[2] || '').trim();
  if (!id) {
    console.error('Uso: node backend/scripts/check_siigo_customer_by_identification.js <identificacion>');
    process.exit(1);
  }

  try {
    // Autenticación y headers
    const headers = await siigoService.getHeaders();
    const base = siigoService.getBaseUrl() || 'https://api.siigo.com';

    const url = `${base}/v1/customers`;
    const params = {
      identification: id,
      page: 1,
      page_size: 20
    };

    console.log(`🔎 Verificando disponibilidad de SIIGO y consultando cliente con identificación: ${id}`);
    const start = Date.now();
    const resp = await axios.get(url, { headers, params, timeout: 20000 });
    const ms = Date.now() - start;

    console.log(`✅ SIIGO respondió (${resp.status}) en ${ms}ms`);
    const data = resp.data || {};
    const results = Array.isArray(data.results) ? data.results : [];
    console.log(`📊 Resultados recibidos: ${results.length}`);

    if (results.length > 0) {
      const c = results[0] || {};
      const extractName = (cust) => {
        if (!cust) return 'Sin nombre';
        if (cust.commercial_name && cust.commercial_name !== 'No aplica') return cust.commercial_name;
        if (cust.company?.name) return cust.company.name;
        if (Array.isArray(cust.name) && cust.name.length) return cust.name.join(' ');
        if (cust.person?.first_name) return `${cust.person.first_name} ${cust.person.last_name || ''}`.trim();
        return cust.identification?.name || cust.name || 'Sin nombre';
        };
      const name = extractName(c);
      const identification = c.identification || (c.identification_number || null);

      console.log('🧾 Cliente (primer resultado):');
      console.log(` - id: ${c.id || 'N/A'}`);
      console.log(` - identificación: ${identification || 'N/A'}`);
      console.log(` - person_type: ${c.person_type || 'N/A'}`);
      console.log(` - nombre: ${name}`);
      console.log(` - email: ${c.email || (c.contacts?.[0]?.email || 'N/A')}`);

      const exact = String(identification || '').replace(/\s+/g, '') === id.replace(/\s+/g, '');
      console.log(`🎯 Coincidencia exacta de identificación: ${exact ? 'SÍ' : 'NO'}`);
    } else {
      console.log('ℹ️ No se encontraron clientes con esa identificación.');
    }

    console.log('✔️ Validación completada.');
    process.exit(0);
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const retryAfter = error.response.headers?.['retry-after'];
      if (status === 429) {
        console.error(`⛔ SIIGO rate limit (429). Retry-After: ${retryAfter || 'no especificado'}.`);
        process.exit(2);
      }
      if (status === 401) {
        console.error('🔒 Error de autenticación contra SIIGO (401). Verificar credenciales.');
        process.exit(3);
      }
      console.error(`❌ Error HTTP ${status} al consultar SIIGO:`, error.response.data || error.message);
      process.exit(1);
    } else if (error.code === 'ECONNABORTED') {
      console.error('⏱️ Timeout al consultar SIIGO.');
      process.exit(4);
    } else {
      console.error('❌ Error al consultar SIIGO:', error.message || error);
      process.exit(1);
    }
  }
}

main();
