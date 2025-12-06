#!/usr/bin/env node
/**
 * Full re-sync de stock para TODOS los productos con siigo_id no nulo.
 * - Consulta SIIGO (por UUID o por code) y actualiza products.available_quantity
 * - Usa la misma lógica robusta de StockSyncService.updateProductStock
 * - Procesa en lotes para respetar rate limits
 *
 * Uso:
 *   node backend/scripts/full_resync_products_stock.js [batchSize=100]
 */
const StockSyncService = require('../services/stockSyncService');
const { pool } = require('../config/database');

(async () => {
  const batchSize = Number(process.argv[2] || 100);
  const svc = new StockSyncService();

  try {
    console.log('🔄 Iniciando FULL RE-SYNC de stock para todos los productos con siigo_id...');
    // Asegurar autenticación SIIGO
    await svc.ensureValidToken();

    // Obtener total
    const [countRows] = await pool.execute(`
      SELECT COUNT(*) AS total 
      FROM products 
      WHERE siigo_id IS NOT NULL AND TRIM(siigo_id) <> ''
    `);
    const total = countRows?.[0]?.total || 0;
    if (total === 0) {
      console.log('ℹ️  No hay productos con siigo_id para sincronizar.');
      process.exit(0);
    }

    console.log(`📦 Total productos por sincronizar: ${total}`);
    const pages = Math.ceil(total / batchSize);

    let updated = 0;
    let unchanged = 0;
    let errors = 0;

    for (let page = 0; page < pages; page++) {
      const offset = page * batchSize;
      const [rows] = await pool.execute(`
        SELECT id, siigo_id, product_name, available_quantity, is_active
        FROM products
        WHERE siigo_id IS NOT NULL AND TRIM(siigo_id) <> ''
        ORDER BY IFNULL(last_sync_at, '1970-01-01') ASC, updated_at ASC
        LIMIT ? OFFSET ?
      `, [batchSize, offset]);

      console.log(`\n📑 Lote ${page + 1}/${pages} (filas: ${rows.length})`);

      // Reutilizar una sola conexión para el lote
      const connection = await svc.getConnection();
      try {
        for (const product of rows) {
          try {
            const changed = await svc.updateProductStock(connection, product);
            if (changed) {
              updated++;
            } else {
              unchanged++;
            }

            // Rate limit adaptativo similar al servicio
            const baseDelay = Math.min(Math.max(require('../services/siigoService').rateLimitDelay || 1000, 500), 2000);
            const jitter = Math.floor(Math.random() * 250);
            await new Promise(r => setTimeout(r, baseDelay + jitter));
          } catch (err) {
            errors++;
            console.error(`❌ Error sync id=${product.id} siigo_id=${product.siigo_id}:`, err?.message || err);
            // Pequeña pausa ante error para no llevar al límite
            await new Promise(r => setTimeout(r, 500));
          }
        }
      } finally {
        await connection.end();
      }
    }

    console.log('\n✅ FULL RE-SYNC completado');
    console.log(`📊 Totales: actualizados=${updated}, sin_cambios=${unchanged}, errores=${errors}`);
    process.exit(0);
  } catch (e) {
    console.error('❌ Error en FULL RE-SYNC:', e?.message || e);
    process.exit(1);
  }
})();
