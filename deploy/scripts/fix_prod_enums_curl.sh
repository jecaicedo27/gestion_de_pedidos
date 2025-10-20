#!/usr/bin/env bash
set -euo pipefail

# cURL-friendly script: no depende de la ubicación del archivo.
# Aplica ALTER a ENUMs directamente usando el pool del backend y reinicia PM2.
# Requisitos: node, pm2 y que el backend exista en /var/www/gestion_de_pedidos/backend

BACKEND_DIR="/var/www/gestion_de_pedidos/backend"

echo "=== Gestion de Pedidos: Fix ENUMs via cURL ==="
echo "Backend dir: ${BACKEND_DIR}"

if [ ! -d "${BACKEND_DIR}" ]; then
  echo "ERROR: No existe ${BACKEND_DIR}. Ajusta BACKEND_DIR dentro de este script si tu ruta es distinta."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node no está instalado en el servidor."
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "ERROR: pm2 no está instalado en el servidor."
  exit 1
fi

NODE_SCRIPT="/tmp/patch_enums_node_20251019.js"
cat > "${NODE_SCRIPT}" <<'EOF'
const db = require('/var/www/gestion_de_pedidos/backend/config/database');

(async () => {
  try {
    console.log('--- ALTER orders.payment_method ---');
    await db.query(`
      ALTER TABLE orders
      MODIFY payment_method ENUM(
        'efectivo','transferencia','tarjeta_credito','pago_electronico',
        'cheque','credito','contraentrega','cortesia','datafono','auto'
      ) DEFAULT 'efectivo'
    `);
    console.log('OK: orders.payment_method');

    console.log('--- ALTER siigo_sync_log.sync_type ---');
    await db.query(`
      ALTER TABLE siigo_sync_log
      MODIFY sync_type ENUM('webhook','manual','automatic','update') NOT NULL
    `);
    console.log('OK: siigo_sync_log.sync_type');

    // Verificación
    const pm = await db.query("SHOW COLUMNS FROM orders LIKE 'payment_method'");
    const st = await db.query("SHOW COLUMNS FROM siigo_sync_log LIKE 'sync_type'");
    console.log('orders.payment_method =>', pm[0]?.Type || pm[0]);
    console.log('siigo_sync_log.sync_type =>', st[0]?.Type || st[0]);
  } catch (e) {
    console.error('ERROR:', e.code, e.message);
    process.exitCode = 1;
  } finally {
    try { await db.poolEnd(); } catch {}
    process.exit();
  }
})();
EOF

echo "Running Node patch..."
node "${NODE_SCRIPT}"

echo "Restarting PM2 process..."
pm2 restart gestion-backend --update-env

echo "Recent PM2 logs:"
pm2 logs gestion-backend --lines 120 --nostream || true

echo "Health check:"
curl -i --max-time 5 http://127.0.0.1/api/health || true

echo "=== Done ==="
