#!/usr/bin/env bash
# Deploy rápido SOLO del Frontend (InventoryBillingPage) a producción
# Uso:
#   HOST=72.60.175.159 USER=root ./deploy/deploy_frontend_inventory_billing.sh
#   (o simplemente ./deploy/deploy_frontend_inventory_billing.sh si usas los valores por defecto)
set -euo pipefail

HOST=${HOST:-"72.60.175.159"}
USER=${USER:-"root"}
APP_DIR=/var/www/gestion_de_pedidos

echo "==> Copiando InventoryBillingPage.js a $USER@$HOST:$APP_DIR"
scp frontend/src/pages/InventoryBillingPage.js "$USER@$HOST:$APP_DIR/frontend/src/pages/InventoryBillingPage.js"

echo "==> Ejecutando build de frontend y reinicio en $HOST ..."
cat <<'REMOTE' | ssh -T "$USER@$HOST"
set -euo pipefail
APP_DIR=/var/www/gestion_de_pedidos
cd "$APP_DIR"

echo "==> Frontend: npm ci/install y build"
cd frontend
if command -v npm >/dev/null 2>&1; then
  if [ -f package-lock.json ]; then
    npm ci || npm install
  else
    npm install
  fi
  npm run build
else
  echo "ERROR: npm no está instalado en el servidor" >&2
  exit 1
fi

cd "$APP_DIR"
# Reiniciar backend/pm2 para servir el build nuevo si aplica proxy
if command -v pm2 >/dev/null 2>&1; then
  echo "==> Reiniciando procesos pm2 (reload all)"
  pm2 reload all || pm2 restart all || true
elif systemctl is-active --quiet gestion-pedidos 2>/dev/null; then
  echo "==> Reiniciando servicio systemd gestion-pedidos"
  sudo systemctl restart gestion-pedidos
else
  echo "⚠️  No se detectó pm2 ni servicio systemd conocido. Asegura reinicio si es necesario."
fi

echo "==> Build finalizado. Artefacto en: $APP_DIR/frontend/build"
REMOTE

echo "✅ Deploy de InventoryBillingPage.js completado."
echo "Abre https://gestionperlas.app/inventory-billing y realiza Ctrl+F5 para ver los cambios."
