#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/var/www/gestion_de_pedidos"
cd "$PROJECT_DIR"

log() { printf "\033[1;34m[restart]\033[0m %s\n" "$*"; }

log "Reiniciando backend y frontend en $PROJECT_DIR"

# Intento opcional con PM2 si está disponible (ignorar errores)
if command -v pm2 &>/dev/null; then
  log "PM2 detectado. Intentando reiniciar procesos gestion-backend/gestion-frontend (si existen)"
  pm2 restart gestion-backend &>/dev/null || true
  pm2 restart gestion-frontend &>/dev/null || true
fi

# Matar posibles procesos previos (seguro)
log "Terminando procesos Node/Vite/React conocidos del proyecto (si existen)"
pkill -f "/var/www/gestion_de_pedidos/backend/server.js" &>/dev/null || true
pkill -f "react-scripts start" &>/dev/null || true
pkill -f "vite" &>/dev/null || true

# Backend
start_backend() {
  if [[ -f backend/package.json ]]; then
    if grep -q '"dev"' backend/package.json; then
      log "Iniciando backend con: npm run dev"
      (cd backend && npm run dev &>/dev/null &)
      return
    fi
    if grep -q '"start"' backend/package.json; then
      log "Iniciando backend con: npm start"
      (cd backend && npm start &>/dev/null &)
      return
    fi
  fi

  if [[ -f backend/server.js ]]; then
    log "Iniciando backend con: node backend/server.js"
    (node backend/server.js &>/dev/null &)
  else
    log "No se encontró cómo iniciar el backend"
  fi
}

# Frontend
start_frontend() {
  if [[ -f frontend/package.json ]]; then
    if grep -q '"start"' frontend/package.json; then
      log "Iniciando frontend con: npm start"
      (cd frontend && npm start &>/dev/null &)
      return
    fi
    if grep -q '"dev"' frontend/package.json; then
      log "Iniciando frontend con: npm run dev"
      (cd frontend && npm run dev &>/dev/null &)
      return
    fi
  fi
  log "No se encontró cómo iniciar el frontend"
}

start_backend
start_frontend

sleep 1

log "Procesos Node activos relacionados:"
pgrep -af "node|react-scripts|vite" | sed 's/^/[proc] /' || true

log "Reinicio solicitado. Si usas puertos estándar: frontend:3000 / backend:4000-5000."
log "Haz Ctrl+F5 en el navegador y vuelve a probar FV-2-15156 → Procesar Envío."
