#!/usr/bin/env node
/**
 * Sincroniza un producto específico desde SIIGO por siigo_id (UUID o code)
 * Uso:
 *   node backend/scripts/sync_specific_product.js <siigo_product_id_or_code>
 */
const StockSyncService = require('../services/stockSyncService');

(async () => {
  try {
    const siigoProductId = process.argv[2];
    if (!siigoProductId) {
      console.error('Uso: node backend/scripts/sync_specific_product.js <siigo_product_id_or_code>');
      process.exit(1);
    }

    const stockSync = new StockSyncService();
    const updated = await stockSync.syncSpecificProduct(siigoProductId);
    console.log(JSON.stringify({ ok: true, siigoProductId, updated }, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Error:', e?.message || e);
    process.exit(1);
  }
})();
