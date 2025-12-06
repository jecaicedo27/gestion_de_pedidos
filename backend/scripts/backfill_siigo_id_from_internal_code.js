#!/usr/bin/env node
/**
 * Backfill de siigo_id para productos activos que no lo tienen,
 * usando el internal_code como código en SIIGO.
 * - Consulta SIIGO /v1/products?code={internal_code}
 * - Si encuentra, guarda el UUID de SIIGO en products.siigo_id
 * - También sincroniza available_quantity y marca last_sync_at/stock_updated_at
 *
 * Uso:
 *   node backend/scripts/backfill_siigo_id_from_internal_code.js [limit=500]
 */
const { pool } = require('../config/database');
const siigoService = require('../services/siigoService');

async function main() {
  const limit = Number(process.argv[2] || 500);
  let processed = 0;
  let updated = 0;
  let notFound = 0;
  let errors = 0;

  try {
    console.log('🔧 Backfill siigo_id desde internal_code para productos activos sin siigo_id...');
    // Headers con autenticación
    const headers = await siigoService.getHeaders();

    // Obtener candidatos
    const [rows] = await pool.execute(`
      SELECT id, product_name, internal_code, siigo_id, available_quantity, is_active
      FROM products
      WHERE is_active = 1
        AND (siigo_id IS NULL OR TRIM(siigo_id) = '')
        AND internal_code IS NOT NULL AND TRIM(internal_code) <> ''
      ORDER BY updated_at ASC, id ASC
      LIMIT ?
    `, [limit]);

    if (!Array.isArray(rows) || rows.length === 0) {
      console.log('ℹ️ No hay productos activos sin siigo_id con internal_code para procesar.');
      process.exit(0);
    }

    console.log(`📦 Candidatos encontrados: ${rows.length}`);

    for (const row of rows) {
      processed++;
      const code = String(row.internal_code).trim();

      try {
        const resp = await siigoService.makeRequestWithRetry(async () => {
          // Buscar por code (SKU) en SIIGO
          const axios = require('axios');
          return await axios.get(`${siigoService.getBaseUrl()}/v1/products`, {
            headers,
            params: { code },
            timeout: 30000
          });
        });

        const data = resp?.data;
        const siigoProduct = Array.isArray(data?.results) ? data.results[0] : data;

        if (!siigoProduct || !siigoProduct.id) {
          notFound++;
          console.log(`⚠️ No encontrado en SIIGO por code=${code} (id=${row.id})`);
        } else {
          const newSiigoId = siigoProduct.id;
          const newStock = Number(siigoProduct.available_quantity || 0);
          const newActive = siigoProduct.active !== false;

          await pool.execute(`
            UPDATE products
            SET siigo_id = ?,
                available_quantity = ?,
                is_active = ?,
                stock_updated_at = NOW(),
                last_sync_at = NOW(),
                updated_at = NOW()
            WHERE id = ?
          `, [newSiigoId, newStock, newActive ? 1 : 0, row.id]);

          updated++;
          console.log(`✅ Backfill id=${row.id} code=${code} → siigo_id=${newSiigoId} | stock=${row.available_quantity} → ${newStock} | activo=${row.is_active ? '1' : '0'} → ${newActive ? '1' : '0'}`);

          // Emitir evento WS opcional si el backend está en este mismo proceso
          if (global.io) {
            try {
              global.io.emit('stock_updated', {
                productId: row.id,
                siigoProductId: newSiigoId,
                productName: row.product_name,
                newStock,
                source: 'backfill_siigo_id',
                timestamp: new Date().toISOString()
              });
            } catch {}
          }
        }

      } catch (e) {
        errors++;
        console.error(`❌ Error backfilling id=${row.id} code=${code}:`, e?.message || e);
      }

      // Rate limit adaptativo (igual que otros servicios)
      const baseDelay = Math.min(Math.max(siigoService.rateLimitDelay || 1000, 500), 2000);
      const jitter = Math.floor(Math.random() * 250);
      await new Promise(r => setTimeout(r, baseDelay + jitter));
    }

    console.log('\n🏁 Backfill finalizado');
    console.log(`📊 Resumen: procesados=${processed}, actualizados=${updated}, no_encontrados=${notFound}, errores=${errors}`);
    process.exit(0);
  } catch (e) {
    console.error('❌ Error ejecutando backfill_siigo_id_from_internal_code:', e?.message || e);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch {}
  }
}

main();
