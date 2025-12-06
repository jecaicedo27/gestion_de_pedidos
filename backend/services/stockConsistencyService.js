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

    // Cola de reconciliación: usamos Set para evitar duplicados
    this.queue = new Set();

    // Límites
    this.BATCH_SIZE = 25;          // máximo por ciclo
    this.RECENT_HOURS = 6;         // ventana de recientes para arranque/scan
  }

  async getConn() {
    return await mysql.createConnection(this.dbConfig);
  }

  // Encolas por id local
  enqueueByProductId(id) {
    if (!id) return;
    this.queue.add(JSON.stringify({ type: 'id', value: String(id) }));
  }

  // Encolas por siigo_id (UUID o code)
  enqueueBySiigoId(siigoId) {
    if (!siigoId) return;
    this.queue.add(JSON.stringify({ type: 'siigo', value: String(siigoId) }));
  }

  // Encolas por internal_code (SKU)
  enqueueByCode(code) {
    if (!code) return;
    this.queue.add(JSON.stringify({ type: 'code', value: String(code) }));
  }

  async start() {
    if (this.running) return { running: true };

    this.running = true;
    console.log('🧭 StockConsistencyService: iniciando...');

    // Bootstrapping: encolar productos recientes para convergencia rápida
    try {
      await this.enqueueRecentUpdated();
      console.log('🧭 StockConsistencyService: productos recientes encolados.');
    } catch (e) {
      console.warn('⚠️ StockConsistencyService enqueueRecentUpdated error:', e?.message || e);
    }

    // Timer de procesamiento de cola (cada 30s)
    this.queueTimer = setInterval(() => {
      this.processQueue().catch((e) => {
        console.warn('⚠️ StockConsistencyService processQueue error:', e?.message || e);
      });
    }, 30 * 1000);

    // Timer de re-encolar recientes (cada 5m)
    this.scanRecentTimer = setInterval(() => {
      this.enqueueRecentUpdated().catch((e) => {
        console.warn('⚠️ StockConsistencyService enqueueRecentUpdated error:', e?.message || e);
      });
    }, 5 * 60 * 1000);

    // Timer de encolar más viejos por last_sync_at (cada 10m)
    this.scanOldestTimer = setInterval(() => {
      this.enqueueOldestPending().catch((e) => {
        console.warn('⚠️ StockConsistencyService enqueueOldestPending error:', e?.message || e);
      });
    }, 10 * 60 * 1000);

    // Disparar un primer ciclo de procesamiento pronto (en 5s)
    setTimeout(() => this.processQueue().catch(() => {}), 5000);

    console.log('✅ StockConsistencyService: iniciado.');
    return { running: true };
  }

  stop() {
    if (!this.running) return { running: false };
    try {
      clearInterval(this.queueTimer);
      clearInterval(this.scanRecentTimer);
      clearInterval(this.scanOldestTimer);
    } catch {}
    this.queueTimer = null;
    this.scanRecentTimer = null;
    this.scanOldestTimer = null;
    this.running = false;
    console.log('🛑 StockConsistencyService detenido.');
    return { running: false };
  }

  // Encola últimos N productos con updated_at recientes
  async enqueueRecentUpdated(limit = 200) {
    const conn = await this.getConn();
    try {
      const [rows] = await conn.execute(
        `SELECT id, siigo_id, internal_code, product_name
         FROM products
         WHERE siigo_id IS NOT NULL
           AND updated_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
         ORDER BY updated_at DESC
         LIMIT ?`,
        [this.RECENT_HOURS, limit]
      );
      rows.forEach((r) => {
        if (r.siigo_id) this.enqueueBySiigoId(r.siigo_id);
        else if (r.internal_code) this.enqueueByCode(r.internal_code);
        else this.enqueueByProductId(r.id);
      });
      console.log(`🧾 Encolados recientes: ${rows.length}`);
    } finally {
      await conn.end();
    }
  }

  // Encola más viejos por last_sync_at para convergencia global
  async enqueueOldestPending(limit = 200) {
    const conn = await this.getConn();
    try {
      const [rows] = await conn.execute(
        `SELECT id, siigo_id, internal_code, product_name
         FROM products
         WHERE siigo_id IS NOT NULL
         ORDER BY IFNULL(last_sync_at, '1970-01-01') ASC
         LIMIT ?`,
        [limit]
      );
      rows.forEach((r) => {
        if (r.siigo_id) this.enqueueBySiigoId(r.siigo_id);
        else if (r.internal_code) this.enqueueByCode(r.internal_code);
        else this.enqueueByProductId(r.id);
      });
      console.log(`🧾 Encolados más viejos: ${rows.length}`);
    } finally {
      await conn.end();
    }
  }

  async processQueue() {
    if (!this.running) return;
    const size = this.queue.size;
    if (size === 0) return;

    const batch = Array.from(this.queue).slice(0, this.BATCH_SIZE);
    batch.forEach((k) => this.queue.delete(k)); // sacar del set

    console.log(`🔁 Reconciliando lote: ${batch.length}/${size} pendientes...`);
    for (const k of batch) {
      const item = JSON.parse(k);
      try {
        await this.reconcileOne(item);
        // Delay adaptativo contra 429
        const baseDelay = Math.min(Math.max(siigoService.rateLimitDelay || 1000, 800), 2500);
        const jitter = Math.floor(Math.random() * 300);
        await new Promise((r) => setTimeout(r, baseDelay + jitter));
      } catch (e) {
        // Si hubo 429 o error temporal, reencolar una vez
        console.warn('⚠️ Reconcile error:', e?.message || e);
        this.queue.add(k);
        // Backoff adicional
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }

  async reconcileOne(item) {
    const conn = await this.getConn();
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
      try { await conn.end(); } catch {}
    }
  }
}

const stockConsistencyService = new StockConsistencyService();
module.exports = stockConsistencyService;
