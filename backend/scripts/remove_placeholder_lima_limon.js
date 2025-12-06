#!/usr/bin/env node
/**
 * Elimina placeholders locales de "SKARCHA AZUCAR LIMON X ... GR"
 * creados para visualizar temporalmente en Inventario + Facturación.
 * Uso:
 *   node backend/scripts/remove_placeholder_lima_limon.js
 */
const { query, poolEnd } = require('../config/database');

(async () => {
  try {
    console.log('🧹 Eliminando placeholders de "SKARCHA AZUCAR LIMON X ... GR"...');
    const preview = await query(
      `SELECT id, product_name, siigo_id, barcode 
       FROM products 
       WHERE product_name LIKE 'SKARCHA AZUCAR LIMON X % GR'`
    );
    console.log('Encontrados:', preview.length);
    preview.slice(0, 10).forEach(p => console.log('-', p.id, p.product_name, p.siigo_id || 'sin_siigo', p.barcode || 'sin_barcode'));

    const res = await query(
      `DELETE FROM products 
       WHERE product_name LIKE 'SKARCHA AZUCAR LIMON X % GR'`
    );
    console.log('✅ Eliminados:', res.affectedRows || 0);
  } catch (e) {
    console.error('❌ Error:', e?.message || e);
    process.exitCode = 1;
  } finally {
    await poolEnd().catch(()=>{});
  }
})();
