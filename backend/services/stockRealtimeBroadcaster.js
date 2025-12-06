const { format } = require('date-fns');

/**
 * Broadcaster de cambios de stock a tiempo casi real basado en DB.
 * Objetivo: que la UI reciba eventos stock_updated sin depender exclusivamente
 * de la fuente del cambio (facturas, anulaciones, ingresos, webhooks, sync programada, scripts).
 *
 * Estrategia:
 * - Escanear productos cuyo stock_updated_at o updated_at sea > lastCursor.
 * - Emitir evento WebSocket 'stock_updated' para cada fila cambiada.
 * - Avanzar el cursor al mayor timestamp visto.
 * - Intervalo corto (configurable) para reducir la necesidad de F5.
 */
let intervalHandle = null;
let lastCursor = null;
let started = false;

function toMySQLDateTime(d) {
  // Formato 'YYYY-MM-DD HH:mm:ss'
  try {
    return format(d, 'yyyy-MM-dd HH:mm:ss');
  } catch {
    const iso = new Date(d).toISOString().slice(0, 19).replace('T', ' ');
    return iso;
  }
}

async function scanOnce(pool, io, options = {}) {
  try {
    const now = new Date();
    // Cursor inicial: 2 minutos atrás para captar cambios recientes al iniciar
    if (!lastCursor) {
      lastCursor = new Date(now.getTime() - 2 * 60 * 1000);
    }

    const cursorStr = toMySQLDateTime(lastCursor);
    const sql = `
      SELECT 
        id, 
        product_name, 
        available_quantity, 
        GREATEST(
          IFNULL(stock_updated_at, '1970-01-01 00:00:00'),
          IFNULL(updated_at, '1970-01-01 00:00:00')
        ) AS ts
      FROM products
      WHERE is_active = 1
        AND (
          (stock_updated_at IS NOT NULL AND stock_updated_at > ?) OR
          (updated_at IS NOT NULL AND updated_at > ?)
        )
      ORDER BY ts ASC
      LIMIT 200
    `;
    const [rows] = await pool.execute(sql, [cursorStr, cursorStr]);

    if (Array.isArray(rows) && rows.length > 0) {
      let maxTs = lastCursor;
      for (const row of rows) {
        const ts = new Date(row.ts || row.updated_at || row.stock_updated_at || now);
        if (ts > maxTs) maxTs = ts;

        // Emitir evento a todos los clientes
        try {
          const payload = {
            productId: row.id,
            productName: row.product_name,
            newStock: Number(row.available_quantity || 0),
            source: 'db_watch',
            timestamp: new Date().toISOString()
          };
          io.emit('stock_updated', payload);
          io.to('siigo-updates').emit('stock_updated', payload);
        } catch (e) {
          // No romper el ciclo por errores de socket
          // eslint-disable-next-line no-console
          console.warn('WS emit error (db_watch):', e?.message || e);
        }
      }
      lastCursor = maxTs;
    } else {
      // Si no hay filas, avanzar cursor para evitar quedarse atrás indefinidamente
      const bumpMs = Number(process.env.STOCK_REALTIME_INTERVAL_MS || 1000);
      lastCursor = new Date(new Date(lastCursor).getTime() + bumpMs);
      if (lastCursor > now) lastCursor = now;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('StockRealtimeBroadcaster scan error:', err?.message || err);
  }
}

function start(pool, io, options = {}) {
  if (started) return { running: true };
  const intervalMs = Number(process.env.STOCK_REALTIME_INTERVAL_MS || 1000);
  // Primer cursor null, y primera corrida inmediata para captar cambios iniciales
  lastCursor = null;

  intervalHandle = setInterval(() => {
    scanOnce(pool, io, options);
  }, intervalMs);

  // Primer escaneo inmediato
  scanOnce(pool, io, options).catch(() => {});

  started = true;
  // eslint-disable-next-line no-console
  console.log(`🛰️ StockRealtimeBroadcaster iniciado (intervalo ${intervalMs}ms)`);
  return { running: true, intervalMs };
}

function stop() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  started = false;
  // eslint-disable-next-line no-console
  console.log('🛑 StockRealtimeBroadcaster detenido');
  return { running: false };
}

module.exports = {
  start,
  stop
};
