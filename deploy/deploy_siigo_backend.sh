#!/usr/bin/env bash
# Deploy rápido de cambios de backend SIIGO (auto-import y servicio SIIGO) a producción
# Uso:
#   HOST=72.60.175.159 USER=root ./deploy/deploy_siigo_backend.sh
# Variables:
#   HOST: IP o dominio del servidor (default 72.60.175.159)
#   USER: usuario SSH (default root)
set -euo pipefail

HOST=${HOST:-"72.60.175.159"}
USER=${USER:-"root"}
APP_DIR=/var/www/gestion_de_pedidos

echo "==> Copiando archivos de backend SIIGO al servidor $USER@$HOST:$APP_DIR"
# Servicios y archivos relevantes modificados
scp backend/services/siigoAutoImportService.js     "$USER@$HOST:$APP_DIR/backend/services/siigoAutoImportService.js"
scp backend/services/siigoService.js               "$USER@$HOST:$APP_DIR/backend/services/siigoService.js"
# Opcionales por si se requiere en la instancia
scp backend/initAutoImport.js                      "$USER@$HOST:$APP_DIR/backend/initAutoImport.js" || true
scp backend/controllers/siigoController.js         "$USER@$HOST:$APP_DIR/backend/controllers/siigoController.js" || true

# Ejecutar reinicio en remoto (pm2 o systemd)
cat <<'REMOTE' | ssh -T "$USER@$HOST"
set -euo pipefail
APP_DIR=/var/www/gestion_de_pedidos
cd "$APP_DIR"

# Instalar dependencias backend si fuera necesario (normalmente no cambia package.json)
if [ -f backend/package.json ]; then
