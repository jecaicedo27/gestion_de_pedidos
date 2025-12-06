#!/usr/bin/env node
/**
 * Auditoría de consistencia SIIGO vs BD local (stock).
 * - Toma un muestreo de productos activos (por defecto 50)
 * - Para cada producto consulta SIIGO por UUID o por code (siigo_id no-UUID)
 * - Reporta diferencias de available_quantity y estado activo
 *
 * Uso:
 *   node backend/scripts/audit_siigo_vs_local_stock.js [limit=50]
 */
const mysql = require('mysql2/promise');
const axios = require('axios');
const siigoService = require('../services/siigoService');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
}

async function getPool() {
  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;
  return await mysql.createPool({
    host: DB_HOST || '127.0.0.1',
    user: DB_USER || 'root',
    password: DB_PASSWORD || '',
    database: DB_NAME || 'gestion_pedidos_dev',
    port: Number(DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 5,
    charset: 'utf8mb4',
    timezone: '+00:00'
  });
}

async function fetchFromSiigo(headers, siigoId) {
  let resp;
  try {
    if (isUuid(siigoId)) {
      resp = await siigoService.makeRequestWithRetry(async () => {
        return await axios.get(`${siigoService.getBaseUrl()}/v1/products/${siigoId}`, { headers, timeout: 30000 });
      });
    } else {
      resp = await siigoService.makeRequestWithRetry(async () => {
        return await axios.get(`${siigoService.getBaseUrl()}/v1/products`, { headers, params: { code: siigoId }, timeout: 30000 });
      });
    }
  } catch (err) {
    // Fallback cruzado si aplica
    if (isUuid(siigoId) && (err.response?.status === 400 || err.response?.status === 404)) {
      resp = await siigoService.makeRequestWithRetry(async () => {
        return await axios.get(`${siigoService.getBaseUrl()}/v1/products`, { headers, params: { code: siigoId }, timeout: 30000 });
      });
    } else if (!isUuid(siigoId) && (err.response?.status === 400 || err.response?.status === 404)) {
      resp = await siigoService.makeRequestWithRetry(async () => {
        return await axios.get(`${siigoService.getBaseUrl()}/v1/products/${siigoId}`, { headers, timeout: 30000 });
      });
    } else {
      throw err;
    }
  }

  const data = resp?.data;
  const prod = Array.isArray(data?.results) ? data.results[0] : data;
  return prod || null;
}

async function main() {
  const limit = Number(process.argv[2] || 50);
  const pool = await getPool();
  let headers;
  try {
    headers = await siigoService.getHeaders();
  } catch (e) {
    console.error('❌ No se pudo obtener headers de SIIGO:', e?.message || e);
    process.exit(1);
  }

  try {
    const [rows] = await pool.execute(`
      SELECT id, product_name, siigo_id, internal_code, available_quantity, is_active
      FROM products
      WHERE is_active = 1
        AND siigo_id IS NOT NULL
      ORDER BY IFNULL(last_sync_at, '1970-01-01') ASC, updated_at ASC
      LIMIT ?
    `, [limit]);

    if (!Array.isArray(rows) || rows.length === 0) {
      console.log('ℹ️ No hay productos activos con siigo_id para auditar.');
      process.exit(0);
    }

    console.log(`🔍 Auditando ${rows.length} productos activos (muestra)`);

    let checked = 0;
    let mismatches = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        const siigoProd = await fetchFromSiigo(headers, row.siigo_id);
        if (!siigoProd) {
          console.log(`⚠️ No encontrado en SIIGO: id=${row.id} siigo_id=${row.siigo_id}`);
          errors++;
        } else {
          const sStock = Number(siigoProd.available_quantity || 0);
          const sActive = siigoProd.active !== false;
          const lStock = Number(row.available_quantity || 0);
          const lActive = row.is_active ? true : false;

          const diffs = [];
          if (sStock !== lStock) diffs.push(`stock ${lStock} → ${sStock}`);
          if (sActive !== lActive) diffs.push(`activo ${lActive ? '1':'0'} → ${sActive ? '1':'0'}`);

          if (diffs.length > 0) {
            mismatches++;
            console.log(`❌ Mismatch [${row.id}] ${row.product_name}: ${diffs.join(', ')}`);
          }
        }
        checked++;
      } catch (e) {
        errors++;
        console.log(`❌ Error auditando [${row.id}] ${row.product_name}:`, e?.message || e);
      }

      // Rate limit adaptativo simple
      const baseDelay = Math.min(Math.max(siigoService.rateLimitDelay || 1000, 500), 2000);
      const jitter = Math.floor(Math.random() * 250);
      await sleep(baseDelay + jitter);
    }

    console.log('\n📊 Resumen auditoría');
    console.log(`   revisados=${checked}, diferencias=${mismatches}, errores=${errors}`);
    process.exit(mismatches > 0 ? 2 : 0);
  } catch (e) {
    console.error('❌ Error en auditoría:', e?.message || e);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch {}
  }
}

main();
