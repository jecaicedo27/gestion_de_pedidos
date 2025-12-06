#!/usr/bin/env node
/**
 * Importa/actualiza productos específicos desde SIIGO por code (SKU), p.ej. SKARCHA12 SKARCHA7
 * Uso:
 *   node backend/scripts/import_siigo_product_by_code.js SKARCHA12 SKARCHA7
 */
const { query, poolEnd } = require('../config/database');
const siigoService = require('../services/siigoService');
const axios = require('axios');

function normalizeBarcode(input) {
  if (input === null || input === undefined) return null;
  let s = String(input).trim();
  s = s.replace(/,/g, '.').replace(/\s+/g, '');
  if (/^\d+(?:\.\d+)?$/.test(s)) {
    return s.split('.')[0];
  }
  return s;
}

function extractBarcodeFromSiigo(siigoProduct) {
  if (siigoProduct.barcode && String(siigoProduct.barcode).trim()) {
    return String(siigoProduct.barcode).trim();
  }
  if (siigoProduct.additional_fields?.barcode && String(siigoProduct.additional_fields.barcode).trim()) {
    return String(siigoProduct.additional_fields.barcode).trim();
  }
  if (siigoProduct.metadata && Array.isArray(siigoProduct.metadata)) {
    const barcodeField = siigoProduct.metadata.find(meta =>
      meta?.name && (
        meta.name.toLowerCase().includes('barcode') ||
        meta.name.toLowerCase().includes('codigo') ||
        meta.name.toLowerCase().includes('barra')
      )
    );
    if (barcodeField && barcodeField.value && String(barcodeField.value).trim()) {
      return String(barcodeField.value).trim();
    }
  }
  return null;
}

function extractPriceFromSiigo(product) {
  try {
    if (
      product.prices &&
      Array.isArray(product.prices) &&
      product.prices.length > 0 &&
      product.prices[0].price_list &&
      Array.isArray(product.prices[0].price_list) &&
      product.prices[0].price_list.length > 0
    ) {
      return parseFloat(product.prices[0].price_list[0].value) || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

function guessSubcategoryFromName(name) {
  const n = String(name || '').toUpperCase();
  if (n.includes('LIMA') && n.includes('LIMON')) return 'LIMA LIMON';
  if (n.includes('LIMON')) return 'LIMON';
  if (n.includes('LIMA')) return 'LIMA';
  return null;
}

async function fetchProductByCode(code) {
  const headers = await siigoService.getHeaders();
  const base = siigoService.getBaseUrl();
  const resp = await siigoService.makeRequestWithRetry(async () =>
    axios.get(`${base}/v1/products`, {
      headers,
      params: { code },
      timeout: 30000
    })
  );
  const data = resp?.data;
  if (!data) return null;
  if (Array.isArray(data.results)) {
    // Prefer exact match by code if multiple
    const exact = data.results.find(p => (p.code || '').toUpperCase() === String(code).toUpperCase());
    return exact || data.results[0] || null;
  }
  return data;
}

async function upsertProduct(siigoProduct) {
  const productName = siigoProduct.name || siigoProduct.description || siigoProduct.code || 'Producto SIIGO';
  const internalCode = siigoProduct.code || null;
  const category = siigoProduct.account_group?.name || siigoProduct.category?.name || null;
  const description = siigoProduct.description || '';
  const standardPrice = extractPriceFromSiigo(siigoProduct);
  const siigoId = siigoProduct.id || null;
  const availableQuantity = typeof siigoProduct.available_quantity === 'number' ? siigoProduct.available_quantity : 0;
  let barcodeRaw = extractBarcodeFromSiigo(siigoProduct);
  let barcode = normalizeBarcode(barcodeRaw);
  const subcategory = guessSubcategoryFromName(productName);
  const isActive = siigoProduct.active === false ? 0 : 1;

  if (!barcode || barcode.length === 0) {
    // Mantener política de no supuestos: si falta barcode, usar el code como identificador no nulo (no generamos aleatorio)
    barcode = String(internalCode || `NOBC-${Date.now()}`).slice(0, 64);
    console.warn(`⚠️ Producto ${internalCode}: sin barcode real en SIIGO. Usando code como barcode para cumplir NOT NULL: ${barcode}`);
  }

  // Detectar existencia
  const existing = await query(
    `SELECT id FROM products 
     WHERE internal_code = ? OR siigo_id = ? 
     LIMIT 1`,
    [internalCode, siigoId]
  );

  if (existing.length > 0) {
    const id = existing[0].id;
    await query(
      `UPDATE products
       SET product_name = ?, barcode = ?, internal_code = ?, category = ?, subcategory = ?, description = ?,
           standard_price = ?, siigo_id = ?, available_quantity = ?, is_active = ?, updated_at = NOW(), last_sync_at = NOW()
       WHERE id = ?`,
      [productName, barcode, internalCode, category, subcategory, description, standardPrice, siigoId, availableQuantity, isActive, id]
    );
    return { action: 'updated', id };
  }

  const res = await query(
    `INSERT INTO products (
      product_name, barcode, internal_code, category, subcategory, description,
      standard_price, siigo_id, available_quantity, is_active, created_at, updated_at, last_sync_at, stock
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW(), ?)`,
    [
      productName, barcode, internalCode, category, subcategory, description,
      standardPrice, siigoId, availableQuantity, isActive, availableQuantity
    ]
  );
  return { action: 'inserted', id: res.insertId };
}

(async () => {
  const codes = process.argv.slice(2).map(s => s.trim()).filter(Boolean);
  if (codes.length === 0) {
    console.error('Uso: node backend/scripts/import_siigo_product_by_code.js <CODE1> <CODE2> ...');
    process.exit(1);
  }

  const results = [];
  try {
    for (const code of codes) {
      console.log(`🔎 Buscando producto en SIIGO por code: ${code}`);
      const siigoProduct = await fetchProductByCode(code);
      if (!siigoProduct) {
        console.error(`❌ No se encontró producto en SIIGO para code ${code}`);
        results.push({ code, success: false, message: 'No encontrado en SIIGO' });
        continue;
      }
      console.log(`✅ SIIGO -> ${siigoProduct.code} | ${siigoProduct.name} | id: ${siigoProduct.id}`);
      const op = await upsertProduct(siigoProduct);
      console.log(`💾 ${op.action.toUpperCase()} producto local id=${op.id} (${code})`);
      results.push({ code, success: true, action: op.action, id: op.id });
    }
  } catch (e) {
    console.error('❌ Error en importación puntual:', e?.message || e);
    process.exitCode = 1;
  } finally {
    await poolEnd().catch(()=>{});
    console.log('📊 Resultado:', JSON.stringify(results, null, 2));
  }
})();
