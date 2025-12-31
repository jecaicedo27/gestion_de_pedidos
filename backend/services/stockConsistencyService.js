const mysql = require('mysql2/promise');
const axios = require('axios');
const siigoService = require('./siigoService');

/**
 * Servicio global y escalable de reconciliación de stock con SIIGO.
 *
 * Objetivos:
 * - Corregir desalineaciones (como LIQUIPP07 local=42 vs SIIGO=39) sin acciones puntuales manuales.
 * - Reconciliar de forma prioritaria productos tocados recientemente en la app (updated_at recientes).
 * - Evitar 429 con rate limit adaptativo y jitter.
 * - Emitir stock_updated para que la UI se refresque sin F5.
 *
 * Estrategia:
 * - Cola interna (Set) para encolar productos por id/code/siigo_id.
 * - Escaneo rápido inicial de productos con updated_at recientes (ej. 6h).
 * - Escaneo periódico de "los más viejos" por last_sync_at para convergencia global.
 * - Procesamiento en lotes pequeños cada 30s con backoff leve.
 */
class StockConsistencyService {
  constructor() {
    this.running = false;

    this.dbConfig = {
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gestion_pedidos_dev',
      port: Number(process.env.DB_PORT || 3306),
      charset: 'utf8mb4',
      timezone: '+00:00'
    };

    // Timers
    this.queueTimer = null;        // cada 30s procesa cola
    this.scanRecentTimer = null;   // cada 5 min re-encola recientes
    this.scanOldestTimer = null;   // cada 10 min encola más viejos por last_sync_at

    // Flag de procesamiento para evitar concurrencia
    this.processing = false;

    // Límites
    this.BATCH_SIZE = 10;          // reducido de 25 a 10
    this.RECENT_HOURS = 6;         // ventana de recientes para arranque/scan

    // Pool de conexiones para evitar overhead de handshake constante
    this.pool = mysql.createPool({
      ...this.dbConfig,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0
    });
  }

  async getConn() {
    return await this.pool.getConnection();
  }

  // ... (omitted)

  async processQueue() {
    if (!this.running) return;
    if (this.processing) {
      console.log('⏳ processQueue ya está en ejecución, omitiendo ciclo.');
      return;
    }

    const size = this.queue.size;
    if (size === 0) return;

    this.processing = true;
    const batch = Array.from(this.queue).slice(0, this.BATCH_SIZE);
    batch.forEach((k) => this.queue.delete(k)); // sacar del set

    console.log(`🔁 Reconciliando lote: ${batch.length}/${size} pendientes...`);

    let conn = null;
    try {
      conn = await this.getConn();
      for (const k of batch) {
        // Verificar si debemos detenernos a mitad de lote
        if (!this.running) break;

        const item = JSON.parse(k);
        try {
          await this.reconcileOne(item, conn);
          // Delay adaptativo contra 429
          const baseDelay = Math.min(Math.max(siigoService.rateLimitDelay || 2000, 1500), 5000);
          const jitter = Math.floor(Math.random() * 500);
          await new Promise((r) => setTimeout(r, baseDelay + jitter));
        } catch (e) {
          // Si hubo 429 o error temporal, reencolar una vez
          console.warn('⚠️ Reconcile error:', e?.message || e);
          this.queue.add(k);
          // Backoff adicional
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    } catch (err) {
      console.error('❌ Error general en processQueue:', err);
    } finally {
      if (conn) conn.release();
      this.processing = false;
    }
  }

  async reconcileOne(item, conn) {
    let shouldRelease = false;
    if (!conn) {
      // Si no se pasó conexión, obtenemos una y marcamos para liberar
      // (aunque en el flujo principal vendrá de processQueue)
      conn = await this.getConn();
      shouldRelease = true;
    }

    try {
      // Resolver producto local
      let row = null;
      if (item.type === 'id') {
        const [r] = await conn.execute(`SELECT id, product_name, siigo_id, internal_code, available_quantity FROM products WHERE id = ? LIMIT 1`, [item.value]);
        if (r.length) row = r[0];
      } else if (item.type === 'siigo') {
        const [bySiigo] = await conn.execute(`SELECT id, product_name, siigo_id, internal_code, available_quantity FROM products WHERE siigo_id = ? LIMIT 1`, [item.value]);
        if (bySiigo.length) row = bySiigo[0];
        if (!row) {
          const [byInternal] = await conn.execute(`SELECT id, product_name, siigo_id, internal_code, available_quantity FROM products WHERE internal_code = ? LIMIT 1`, [item.value]);
          if (byInternal.length) row = byInternal[0];
        }
      } else if (item.type === 'code') {
        const [byCode] = await conn.execute(`SELECT id, product_name, siigo_id, internal_code, available_quantity FROM products WHERE internal_code = ? LIMIT 1`, [item.value]);
        if (byCode.length) row = byCode[0];
        if (!row) {
          const [bySiigo] = await conn.execute(`SELECT id, product_name, siigo_id, internal_code, available_quantity FROM products WHERE siigo_id = ? LIMIT 1`, [item.value]);
          if (bySiigo.length) row = bySiigo[0];
        }
      }

      if (!row || !row.siigo_id) {
        console.log('ℹ️ Producto no resolvible para reconciliar:', item);
        return;
      }

      // Consultar SIIGO (por UUID o por code)
      const headers = await siigoService.getHeaders();
      let resp;
      const siigoId = String(row.siigo_id);
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(siigoId);

      try {
        if (isUuid) {
          resp = await siigoService.makeRequestWithRetry(async () =>
            axios.get(`${siigoService.getBaseUrl()}/v1/products/${siigoId}`, { headers, timeout: 30000 })
          );
        } else {
          resp = await siigoService.makeRequestWithRetry(async () =>
            axios.get(`${siigoService.getBaseUrl()}/v1/products`, { headers, params: { code: siigoId }, timeout: 30000 })
          );
        }
      } catch (err) {
        // Fallback cruzado
        if (isUuid && (err.response?.status === 400 || err.response?.status === 404)) {
          resp = await siigoService.makeRequestWithRetry(async () =>
            axios.get(`${siigoService.getBaseUrl()}/v1/products`, { headers, params: { code: siigoId }, timeout: 30000 })
          );
        } else if (!isUuid && (err.response?.status === 400 || err.response?.status === 404)) {
          resp = await siigoService.makeRequestWithRetry(async () =>
            axios.get(`${siigoService.getBaseUrl()}/v1/products/${siigoId}`, { headers, timeout: 30000 })
          );
        } else {
          throw err;
        }
      }

      const data = resp?.data;
      const prod = Array.isArray(data?.results) ? data.results[0] : data;
      if (!prod) {
        console.log(`⚠️ No encontrado en SIIGO: ${row.siigo_id}`);
        // Marcar last_sync_at para evitar recalentar cola
        await conn.execute(`UPDATE products SET last_sync_at = NOW() WHERE id = ?`, [row.id]);
        return;
      }

      const sStock = Number(prod.available_quantity || 0);
      const lStock = Number(row.available_quantity || 0);
      const active = prod.active !== false;

      if (sStock !== lStock) {
        await conn.execute(
          `UPDATE products 
           SET available_quantity = ?, is_active = ?, stock_updated_at = NOW(), last_sync_at = NOW(), updated_at = NOW()
           WHERE id = ?`,
          [sStock, active, row.id]
        );

        console.log(`🔧 Reconciliado ${row.product_name}: ${lStock} → ${sStock}`);

        if (global.io) {
          global.io.emit('stock_updated', {
            productId: row.id,
            siigoProductId: row.siigo_id,
            productName: row.product_name,
            oldStock: lStock,
            newStock: sStock,
            source: 'consistency_service',
            timestamp: new Date().toISOString()
          });
        }
      } else {
        await conn.execute(`UPDATE products SET last_sync_at = NOW() WHERE id = ?`, [row.id]);
      }
    } finally {
      if (shouldRelease && conn) conn.release();
    }
  }
}

const stockConsistencyService = new StockConsistencyService();
module.exports = stockConsistencyService;
