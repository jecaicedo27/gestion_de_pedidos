#!/usr/bin/env bash
# Deploy Cartera paralelo (bodega_eligible) a servidor remoto
# Uso: HOST=72.60.175.159 USER=root ./deploy/deploy_bodega_eligible.sh
set -euo pipefail

HOST=${HOST:-"72.60.175.159"}
USER=${USER:-"root"}
APP_DIR=/var/www/gestion_de_pedidos

echo "==> Copiando archivos modificados al servidor $USER@$HOST"
scp backend/controllers/carteraController.js "$USER@$HOST:$APP_DIR/backend/controllers/carteraController.js"
scp frontend/src/pages/CashierCollectionsPage.js "$USER@$HOST:$APP_DIR/frontend/src/pages/CashierCollectionsPage.js"

# (Opcional) scripts de verificación
scp backend/scripts/check_cartera_pending_by_number.js "$USER@$HOST:$APP_DIR/backend/scripts/check_cartera_pending_by_number.js" || true
scp backend/scripts/debug_cartera_pending_preview.js "$USER@$HOST:$APP_DIR/backend/scripts/debug_cartera_pending_preview.js" || true

cat <<'REMOTE' | ssh -T "$USER@$HOST"
set -euo pipefail
APP_DIR=/var/www/gestion_de_pedidos
cd "$APP_DIR"

# Build frontend
echo "==> Compilando frontend (npm ci && npm run build)"
cd frontend
if command -v npm >/dev/null 2>&1; then
  if [ -f package-lock.json ]; then npm ci || npm install; else npm install; fi
  npm run build
else
  echo "ERROR: npm no está instalado en el servidor" >&2
  exit 1
fi

cd "$APP_DIR"
# Reiniciar backend por pm2 o systemd si existen
if command -v pm2 >/dev/null 2>&1; then
  echo "==> Reiniciando backend con pm2"
  pm2 reload all || pm2 restart all || true
elif systemctl is-active --quiet gestion-pedidos 2>/dev/null; then
  echo "==> Reiniciando servicio gestion-pedidos"
  sudo systemctl restart gestion-pedidos
elif systemctl is-active --quiet node-backend 2>/dev/null; then
  echo "==> Reiniciando servicio node-backend"
  sudo systemctl restart node-backend
else
  echo "⚠️  No se detectó pm2 ni systemd. Reinicia tu proceso Node manualmente si aplica."
fi

# Pre-chequeo API local
if command -v curl >/dev/null 2>&1; then
  echo "==> Chequeando API /api/cartera/pending (primeros 500 chars)"
  curl -s http://127.0.0.1:3001/api/cartera/pending | head -c 500 || true
fi
REMOTE

echo "\n✅ Deploy terminado. Abre http://$HOST/cashier-collections, pulsa 'Actualizar' y valida la factura FV-2-15021"
