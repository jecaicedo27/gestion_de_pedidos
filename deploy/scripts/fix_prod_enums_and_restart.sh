#!/usr/bin/env bash
set -euo pipefail

echo "=== Gestion de Pedidos: Fix production ENUMs and restart ==="

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
echo "Root: $ROOT_DIR"

cd "$ROOT_DIR/backend"

echo "Node: $(node -v 2>/dev/null || echo 'not found')"
echo "NPM: $(npm -v 2>/dev/null || echo 'not found')"
echo "PM2: $(pm2 -v 2>/dev/null || echo 'not found')"

# Asegurar carpeta de scripts
mkdir -p scripts

# Crear script Node que aplica los ALTER usando el pool del backend (.env ya configurado en el VPS)
cat > scripts/patch_enums_20251019.js <<'EOF'
const { query, poolEnd } = require('../config/database');

(async () => {
  try {
    console.log('--- ALTER orders.payment_method ---');
    await query(`
      ALTER TABLE orders
      MODIFY payment_method ENUM(
        'efectivo','transferencia','tarjeta_credito','pago_electronico',
        'cheque','credito','contraentrega','cortesia','datafono','auto'
      ) DEFAULT 'efectivo'
    `);
    console.log('OK: orders.payment_method');

    console.log('--- ALTER siigo_sync_log.sync_type ---');
    await query(`
      ALTER TABLE siigo_sync_log
      MODIFY sync_type ENUM('webhook','manual','automatic','update') NOT NULL
    `);
    console.log('OK: siigo_sync_log.sync_type');

    // Verificación
    const [pm] = await query("SHOW COLUMNS FROM orders LIKE 'payment_method'");
    const [st] = await query("SHOW COLUMNS FROM siigo_sync_log LIKE 'sync_type'");
    console.log('orders.payment_method =>', pm?.Type);
    console.log('siigo_sync_log.sync_type =>', st?.Type);
  } catch (e) {
    console.error('ERROR:', e.code, e.message);
    process.exitCode = 1;
  } finally {
    try { await poolEnd(); } catch {}
    process.exit();
  }
})();
EOF

echo "Running Node patch..."
node scripts/patch_enums_20251019.js

echo "Restarting PM2 process..."
pm2 restart gestion-backend --update-env

echo "Recent PM2 logs:"
pm2 logs gestion-backend --lines 120 --nostream || true

echo "Health check:"
curl -i --max-time 5 http://127.0.0.1/api/health || true

echo "=== Done ==="
