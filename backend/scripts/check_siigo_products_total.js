#!/usr/bin/env node
/**
 * Script: check_siigo_products_total.js
 * Objetivo: Consultar SIIGO y mostrar el total de productos retornados por getAllProducts()
 * para comparar contra la BD local.
 */
const siigoService = require('../services/siigoService');

(async () => {
  try {
    const start = Date.now();
    console.log('🔐 Autenticando y consultando productos en SIIGO...');
    const products = await siigoService.getAllProducts(1, 100);
    const elapsed = Math.round((Date.now() - start) / 1000);
    const categories = {};
    for (const p of products) {
      const cat = (p.account_group && p.account_group.name) ? p.account_group.name : (p.category || 'N/A');
      categories[cat] = (categories[cat] || 0) + 1;
    }
    console.log('✅ Consulta completa.');
    console.log(JSON.stringify({
      success: true,
      total_products: Array.isArray(products) ? products.length : 0,
      elapsed_seconds: elapsed,
      sample_first_5: products.slice(0, 5).map(p => ({
        id: p.id,
        code: p.code,
        name: p.name,
        active: p.active !== false
      })),
      categories_top: Object.entries(categories)
        .sort((a,b) => b[1]-a[1])
        .slice(0, 15)
        .map(([k,v]) => ({ category: k, count: v }))
    }, null, 2));
    process.exit(0);
  } catch (e) {
    const payload = e?.response?.data ? e.response.data : (e?.message || String(e));
    console.error('❌ Error consultando productos SIIGO:', typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2));
    process.exit(1);
  }
})();
