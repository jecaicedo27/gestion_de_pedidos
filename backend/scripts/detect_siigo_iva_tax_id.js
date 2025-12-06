#!/usr/bin/env node
/**
 * Script: detect_siigo_iva_tax_id.js
 * Objetivo:
 *  - Detectar automáticamente el ID del impuesto IVA (≈19%) en la cuenta de SIIGO.
 *  - Guardar en system_config:
 *      - siigo_tax_iva_id
 *      - siigo_iva_rate (si se detecta, de lo contrario 19)
 *      - siigo_prices_include_tax (opcional, si se pasa --include=true)
 *
 * Uso:
 *  node backend/scripts/detect_siigo_iva_tax_id.js
 *  node backend/scripts/detect_siigo_iva_tax_id.js --include=true
 *  node backend/scripts/detect_siigo_iva_tax_id.js --page-size=50
 *
 * Estrategia:
 *  1) Intentar listar impuestos via endpoint /v1/taxes (si está disponible).
 *  2) Si no, listar productos /v1/products (página 1) y consultar detalles de algunos hasta encontrar un impuesto tipo IVA ~19%.
 *  3) Guardar configuración encontrada mediante configService.
 */

const axios = require('axios');
const siigoService = require('../services/siigoService');
const configService = require('../services/configService');

function parseArgs() {
  const out = {};
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
    else if (arg.startsWith('--')) out[arg.replace(/^--/, '')] = true;
  }
  return out;
}

function matchesIva19(tax) {
  if (!tax) return false;
  const name = String(tax.name || tax.description || '').toLowerCase();
  const percent = Number(tax.percentage || tax.rate || tax.value || tax.percent || NaN);
  const code = String(tax.type || '').toLowerCase();

  const isIvaName = name.includes('iva');
  const isIvaCode = code.includes('iva');
  const is19 = Number.isFinite(percent) ? Math.abs(percent - 19) < 0.5 : false;

  // Aceptar si indica IVA y ~19%
  return (isIvaName || isIvaCode) && (is19 || name.includes('19'));
}

async function tryListTaxes(headers, baseURL) {
  try {
    const url = `${baseURL}/v1/taxes`;
    console.log(`🔎 Intentando listar impuestos: GET ${url}`);
    const resp = await axios.get(url, { headers, timeout: 20000 });
    const results = resp.data?.results || resp.data || [];
    if (!Array.isArray(results)) return null;

    console.log(`📋 Impuestos recibidos: ${results.length}`);
    for (const t of results) {
      if (matchesIva19(t)) {
        const id = t.id || t.code || t.tax_id;
        const rate = Number(t.percentage || t.rate || 19) || 19;
        if (id) return { id, rate, source: 'taxes_endpoint', raw: t };
      }
    }
    return null;
  } catch (e) {
    console.log(`ℹ️ No fue posible listar /v1/taxes (${e.response?.status || e.code || e.message}). Se intentará por productos.`);
    return null;
  }
}

async function tryFromProducts(headers, baseURL, pageSize = 50, maxDetails = 30) {
  try {
    const url = `${baseURL}/v1/products`;
    console.log(`🔎 Listando productos (solo página 1): GET ${url}?page=1&page_size=${pageSize}`);
    const resp = await axios.get(url, { headers, params: { page: 1, page_size: pageSize }, timeout: 30000 });
    const list = resp.data?.results || [];
    console.log(`📦 Productos en la primera página: ${list.length}`);

    // Revisar si el listado ya trae taxes
    for (const p of list) {
      const taxes = p.taxes || p.tax || [];
      if (Array.isArray(taxes)) {
        for (const t of taxes) {
          if (matchesIva19(t)) {
            const id = t.id || t.code || t.tax_id;
            const rate = Number(t.percentage || t.rate || 19) || 19;
            if (id) return { id, rate, source: 'products_list', product: p, raw: t };
          }
        }
      }
    }

    // Consultar detalles de algunos productos hasta encontrar IVA 19
    let checked = 0;
    for (const p of list) {
      if (checked >= maxDetails) break;
      checked++;
      try {
        const detail = await siigoService.getProductDetails(p.id);
        const taxes = detail?.taxes || [];
        for (const t of taxes) {
          if (matchesIva19(t)) {
            const id = t.id || t.code || t.tax_id;
            const rate = Number(t.percentage || t.rate || 19) || 19;
            if (id) return { id, rate, source: 'product_detail', product: { id: p.id, code: p.code, name: p.name }, raw: t };
          }
        }
      } catch (e) {
        console.log(`⚠️ Error obteniendo detalle de producto ${p.id || p.code}: ${e.message}`);
      }
    }
    return null;
  } catch (e) {
    console.log(`❌ Error listando productos: ${e.message}`);
    return null;
  }
}

(async () => {
  try {
    const args = parseArgs();
    const includeFlag = (args.include === true || String(args.include).toLowerCase() === 'true' || args.include === 1 || String(args.include) === '1');
    const pageSize = Number(args['page-size'] || 50);

    const headers = await siigoService.getHeaders();
    const baseURL = siigoService.getBaseUrl();

    // Paso 1: intentar por endpoint de impuestos
    let found = await tryListTaxes(headers, baseURL);

    // Paso 2: intentar por productos si no se encontró
    if (!found) {
      found = await tryFromProducts(headers, baseURL, pageSize, 30);
    }

    if (!found) {
      console.log('❌ No fue posible detectar automáticamente el ID de IVA 19%.');
      console.log('Sugerencias:');
      console.log('- Verifica en SIIGO el impuesto IVA 19% y suministra su ID.');
      console.log('- O proporciona un producto que sepas que tiene IVA 19% y ajusta el script para consultarlo primero.');
      process.exit(2);
    }

    console.log('✅ IVA detectado:');
    console.log(`   - Tax ID: ${found.id}`);
    console.log(`   - Rate  : ${found.rate}%`);
    console.log(`   - Fuente: ${found.source}`);
    if (found.product) {
      console.log(`   - Producto inspectado: ${JSON.stringify(found.product)}`);
    }

    // Guardar configuración
    await configService.setConfig('siigo_tax_iva_id', Number(found.id), 'number', 'ID impuesto IVA 19% de SIIGO (auto-detectado)');
    await configService.setConfig('siigo_iva_rate', Number(found.rate || 19), 'number', 'Tasa IVA detectada (%)');

    if (includeFlag) {
      await configService.setConfig('siigo_prices_include_tax', 'true', 'boolean', 'Precios incluyen IVA (auto-config)');
      console.log('✅ siigo_prices_include_tax = true');
    }

    // Mostrar estado actual
    const taxIdCurrent = await configService.getConfig('siigo_tax_iva_id', null);
    const ivaRateCurrent = await configService.getConfig('siigo_iva_rate', '19');
    const includeCurrent = await configService.getConfig('siigo_prices_include_tax', 'false');

    console.log('\n📋 Configuración guardada:');
    console.log(`   siigo_tax_iva_id         = ${taxIdCurrent}`);
    console.log(`   siigo_iva_rate           = ${ivaRateCurrent}`);
    console.log(`   siigo_prices_include_tax = ${includeCurrent}`);

    console.log('\nSiguiente paso: crear una factura de prueba desde Inventario + Facturación y verificar en SIIGO que los ítems muestren IVA 19%.');
  } catch (err) {
    console.error('❌ Error detectando IVA:', err.message);
    process.exit(1);
  }
})();
