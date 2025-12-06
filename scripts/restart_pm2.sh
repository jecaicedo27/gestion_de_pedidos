#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/var/www/gestion_de_pedidos"
cd "$PROJECT_DIR"

log() { printf "\033[1;34m[pm2]\033[0m %s\n" "$*"; }

log "Configurando backend/frontend en producción con PM2 y eliminando servidores de desarrollo"

# 1) Matar servidores de desarrollo (solo del proyecto actual)
log "Matando dev servers (react-scripts/nodemon) del proyecto"
pkill -f "/var/www/gestion_de_pedidos/frontend/node_modules/.bin/react-scripts start" &>/dev/null || true
pkill -f "react-scripts start" &>/dev/null || true
pkill -f "/var/www/gestion_de_pedidos/backend/node_modules/.bin/nodemon server.js" &>/dev/null || true
pkill -f "nodemon server.js" &>/dev/null || true

# 2) Construir frontend (si no existe build)
if [[ ! -f frontend/build/index.html ]]; then
  log "Construyendo frontend (no existe build). Esto puede tardar..."
  (cd frontend && npm ci && npm run build)
else
  log "Build de frontend ya existe (frontend/build)."
fi

# 3) Levantar con PM2
if command -v pm2 &>/dev/null; then
  # Backend con PM2
  if pm2 describe gestion-backend &>/dev/null; then
    log "Reiniciando backend en PM2 (gestion-backend)"
    pm2 restart gestion-backend
  else
    log "Iniciando backend en PM2 (gestion-backend)"
    pm2 start backend/server.js --name gestion-backend
  fi

  # Frontend estático con PM2 usando 'serve'
  if pm2 describe gestion-frontend &>/dev/null; then
    log "Eliminando instancia previa de gestion-frontend en PM2 para re-crear"
    pm2 delete gestion-frontend || true
  fi

  log "Levantando frontend estático con 'npx serve -s frontend/build -l 3000' en PM2 (gestion-frontend)"
  pm2 start "npx serve -s frontend/build -l 3000" --name gestion-frontend

  log "Guardando configuración de PM2"
  pm2 save || true
  pm2 ls || true
else
  log "PM2 no está instalado. Instálalo con: npm i -g pm2"
fi

# 4) Recargar Nginx si está disponible (si sirve el frontend o hace proxy)
if command -v nginx &>/dev/null; then
  log "Validando y recargando Nginx"
  nginx -t && (systemctl reload nginx || true)
fi

# 5) Mostrar procesos activos
log "Procesos Node activos:"
pgrep -af "node|react-scripts|nodemon|serve -s frontend/build" | sed 's/^/[proc] /' || true

log "Listo. Backend y frontend quedaron bajo PM2. Accede a gestionperlas.app (Ctrl+F5)."
