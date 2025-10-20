#!/usr/bin/env bash
# =====================================================================
# QUICK SETUP (HTTP) - gestion_de_pedidos
# - Publica el build del frontend (React) en /var/www/frontend
# - Crea/habilita el sitio Nginx con proxy a backend Node (PM2)
# - Detecta automaticamente el puerto del backend (3001 o 3002)
#
# USO (copiar/pegar en el VPS):
#   sudo bash /var/www/gestion_de_pedidos/deploy/scripts/quick_setup_http.sh
#
# Requisitos:
#   - Repo clonado en: /var/www/gestion_de_pedidos
#   - Node + npm instalados
#   - Nginx instalado y activo
#   - Backend levantado con PM2 (puerto 3001 o 3002)
# =====================================================================

set -euo pipefail

# --- Config por defecto (ajusta si tu estructura es distinta) ---
REPO="${REPO:-/var/www/gestion_de_pedidos}"
FRONTEND_ROOT="${FRONTEND_ROOT:-/var/www/frontend}"
SITE_AVAIL="/etc/nginx/sites-available/gestion-pedidos.conf"
SITE_ENABLED="/etc/nginx/sites-enabled/gestion-pedidos.conf"

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "ERROR: Ejecuta como root: sudo bash $0"
    exit 1
  fi
}

log()  { echo -e "\033[1;34m[INFO]\033[0m  $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m  $*"; }
err()  { echo -e "\033[1;31m[ERROR]\033[0m $*" 1>&2; }

detect_backend_port() {
  local port
  for port in 3001 3002; do
    if curl -fsS "http://127.0.0.1:${port}/api/health" >/dev/null 2>&1; then
      echo "${port}"
      return 0
    fi
  done
  # fallback
  echo "3001"
  return 1
}

ensure_repo() {
  if [[ ! -d "${REPO}" ]]; then
    err "No existe ${REPO}. Ajusta la variable REPO y vuelve a ejecutar."
    exit 1
  fi
}

build_frontend() {
  log "Construyendo frontend (npm ci && npm run build)..."
  if [[ ! -d "${REPO}/frontend" ]]; then
    err "No existe ${REPO}/frontend"
    exit 1
  fi
  pushd "${REPO}/frontend" >/dev/null
  npm ci
  npm run build
  popd >/dev/null

  log "Publicando build en ${FRONTEND_ROOT} ..."
  mkdir -p "${FRONTEND_ROOT}"
  rsync -a --delete "${REPO}/frontend/build/" "${FRONTEND_ROOT}/"
  chown -R www-data:www-data "${FRONTEND_ROOT}"
}

write_nginx_conf() {
  local backend_port="$1"

  log "Escribiendo sitio Nginx (${SITE_AVAIL}) con backend en puerto ${backend_port} ..."
  cat > "${SITE_AVAIL}" <<NGINX
upstream pedidos_backend {
    server 127.0.0.1:${backend_port};
    keepalive 64;
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # Frontend (SPA)
    root ${FRONTEND_ROOT};
    index index.html;

    location / {
        try_files \$uri /index.html;
    }

    # API
    location /api/ {
        proxy_pass http://pedidos_backend;
        proxy_http_version 1.1;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection "";

        proxy_buffering off;
    }

    # WebSockets (Socket.IO)
    location /socket.io/ {
        proxy_pass http://pedidos_backend;
        proxy_http_version 1.1;

        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Cache de estáticos
    location ~* \.(?:js|css|woff2?|ttf|eot|ico|svg|gif|jpg|jpeg|png)$ {
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
        try_files \$uri /index.html;
    }
}
NGINX

  ln -sf "${SITE_AVAIL}" "${SITE_ENABLED}"
  rm -f /etc/nginx/sites-enabled/default || true

  log "Probando Nginx (nginx -t) ..."
  nginx -t
  log "Recargando Nginx ..."
  systemctl reload nginx
}

print_summary() {
  local backend_port="$1"
  echo
  echo "================= RESUMEN ================="
  echo "Frontend root:   ${FRONTEND_ROOT}"
  echo "Nginx site:      ${SITE_AVAIL}"
  echo "Backend puerto:  ${backend_port}"
  echo
  echo "Pruebas rápidas:"
  echo "  - Local VPS (proxy Nginx):   curl -I http://127.0.0.1/api/health"
  echo "  - Desde navegador:           http://46.202.93.54/"
  echo "                               http://46.202.93.54/api/health"
  echo
  echo "Si /api/health sigue en 502:"
  echo "  - Verifica PM2: pm2 ls"
  echo "  - Confirma puerto real: curl -I http://127.0.0.1:3001/api/health || curl -I http://127.0.0.1:3002/api/health"
  echo "  - Cambia el puerto en ${SITE_AVAIL} y: nginx -t && systemctl reload nginx"
  echo "==========================================="
}

main() {
  require_root
  ensure_repo

  # Mostrar info útil
  { node -v && npm -v; } >/dev/null 2>&1 || warn "Node/npm no detectados en PATH (pero podrías tenerlos)."
  command -v pm2 >/dev/null 2>&1 || warn "PM2 no detectado en PATH (si el backend no corre, instálalo: npm i -g pm2)."

  build_frontend

  local backend_port
  if backend_port="$(detect_backend_port)"; then
    log "Backend detectado en puerto ${backend_port}"
  else
    warn "No se pudo detectar el backend automáticamente. Se usará ${backend_port} (intenta 3001 por defecto)."
  fi

  write_nginx_conf "${backend_port}"

  print_summary "${backend_port}"
}

main "$@"
