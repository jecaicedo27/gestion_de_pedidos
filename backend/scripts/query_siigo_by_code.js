#!/usr/bin/env node
/**
 * Consulta en SIIGO por code (SKU) y muestra el conteo y resumen.
 * Uso:
 *   node backend/scripts/query_siigo_by_code.js LIQUIPP07
 */
const axios = require('axios');
const siigoService = require('../services/siigoService');

(async () => {
  const code = (process.argv[2] || 'LIQUIPP07').trim();

  try {
    const headers = await siigoService.getHeaders();
    const base = siigoService.getBaseUrl();

    const resp = await siigoService.makeRequestWithRetry(async () =>
      axios.get(`${base}/v1/products`, {
        headers,
        params: { code },
        timeout: 30000
      })
    );

    const data = resp?.data || {};
    const results = Array.isArray(data.results) ? data.results : (data ? [data] : []);
    const normalized = results
      .filter(Boolean)
      .map(p => ({
        id: p.id,
        code: p.code || code,
        name: p.name,
        available_quantity: typeof p.available_quantity === 'number' ? p.available_quantity : null,
        active: p.active !== false
      }));

    console.log(JSON.stringify({
      success: true,
      queried_code: code,
      count: normalized.length,
      products: normalized
    }, null, 2));
    process.exit(0);
  } catch (e) {
    const payload = e?.response?.data ? e.response.data : (e?.message || String(e));
    console.error('ERROR querying SIIGO for code:', code, '\n', typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2));
    process.exit(1);
  }
})();
