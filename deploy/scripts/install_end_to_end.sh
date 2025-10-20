#!/usr/bin/env bash
# ============================================================================
# INSTALL END-TO-END (HTTP) - gestion_de_pedidos
# - Prepara servidor Ubuntu (Node, PM2, Nginx, MariaDB/MySQL)
# - Genera .env del backend (con variables o prompts)
# - Instala dependencias backend/frontend
# - Ejecuta migración portable de BD (scripts/fix_enums_portable.js)
# - Publica frontend detrás de Nginx y levanta backend con PM2
#
# Uso recomendado (en el VPS Ubuntu):
#   sudo bash deploy/scripts/install_end_to_end.sh
#
# Variables de entorno opcionales (para instalar sin prompts):
#   GP_REPO_PATH=/var/www/gestion_de_pedidos
#   GP_PUBLIC_HOST=46.202.93.54            # dominio o IP pública
#   GP_BACKEND_PORT=3001
#   GP_DB_NAME=gestion_pedidos_dev
#   GP_DB_USER=gp_user
#   GP_DB_PASS=gp_pass_123
#   GP_DB_ROOT_PASS=...                    # si root NO usa auth_socket
#   GP_SIIGO_USERNAME=...
#   GP_SIIGO_ACCESS_KEY=...
#   GP_SIIGO_BASE_URL=https://api.siigo.com
#   GP_JWT_SECRET=...                      # si se omite se genera aleatorio
#   GP_FRONTEND_ROOT=/var/www/gestion-frontend
#
# Idempotente: se puede ejecutar múltiples veces sin romper el sistema.
# ============================================================================

set -euo pipefail

# -------------------------- Utilidades de log -------------------------------
log()  { echo -e "\033[1;34m[INFO]\033[0m  $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m  $*"; }
err()  { echo -e "\033[1;31m[ERROR]\033[0m $*" 1>&2; }
hr()   { echo "---------------------------------------------------------------------------"; }

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    err "Ejecuta como root: sudo bash $0"
    exit 1
  fi
}

require_ubuntu() {
  if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    if [[ "${ID:-}" != "ubuntu" && "${ID_LIKE:-}" != *debian* ]]; then
      warn "SO no es Ubuntu/Debian. Intentaré continuar, pero los comandos apt pueden fallar."
    fi
  fi
}

# -------------------------- Variables por defecto ---------------------------
REPO_PATH="${GP_REPO_PATH:-/var/www/gestion_de_pedidos}"
PUBLIC_HOST="${GP_PUBLIC_HOST:-}"
BACKEND_PORT="${GP_BACKEND_PORT:-3001}"
FRONTEND_ROOT="${GP_FRONTEND_ROOT:-/var/www/gestion-frontend}"

DB_NAME="${GP_DB_NAME:-gestion_pedidos_dev}"
DB_USER="${GP_DB_USER:-gp_user}"
DB_PASS="${GP_DB_PASS:-}"
DB_ROOT_PASS="${GP_DB_ROOT_PASS:-}"

SIIGO_USERNAME="${GP_SIIGO_USERNAME:-}"
SIIGO_ACCESS_KEY="${GP_SIIGO_ACCESS_KEY:-}"
SIIGO_BASE_URL="${GP_SIIGO_BASE_URL:-https://api.siigo.com}"

JWT_SECRET="${GP_JWT_SECRET:-}"

NGINX_SITE_AVAIL="/etc/nginx/sites-available/gestion-pedidos.conf"
NGINX_SITE_ENABLED="/etc/nginx/sites-enabled/gestion-pedidos.conf"

PM2_APP="gestion-backend"

# -------------------------- Helpers del sistema -----------------------------
apt_install() {
  local pkgs=("$@")
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${pkgs[@]}"
}

ensure_packages() {
  log "Actualizando índices de paquetes..."
  apt-get update -y

  log "Instalando Nginx, curl, rsync y utilidades..."
  apt_install nginx curl rsync ca-certificates gnupg lsb-release

  if ! command -v node >/dev/null 2>&1; then
    log "Node.js no detectado. Instalando NodeSource 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt_install nodejs
  else
    log "Node.js detectado: $(node -v)"
  fi

  if ! command -v pm2 >/dev/null 2>&1; then
    log "Instalando PM2 (global)..."
    npm i -g pm2
  else
    log "PM2 detectado: $(pm2 -v)"
  fi

  if ! command -v mysql >/dev/null 2>&1 && ! command -v mariadb >/dev/null 2>&1; then
    log "Instalando MariaDB Server..."
    apt_install mariadb-server
    systemctl enable mariadb
    systemctl start mariadb
  else
    log "MySQL/MariaDB detectado."
  fi
}

# -------------------------- MySQL helpers -----------------------------------
mysql_exec() {
  local sql="$1"
  # Primer intento: auth_socket (Ubuntu por defecto)
  if mysql -u root -e "$sql" >/dev/null 2>&1; then
    return 0
  fi
  # Segundo intento: contraseña root si fue provista
  if [[ -n "${DB_ROOT_PASS}" ]]; then
    if mysql -u root "-p${DB_ROOT_PASS}" -e "$sql" >/dev/null 2>&1; then
      return 0
    fi
  fi
  return 1
}

ensure_database() {
  log "Configurando base de datos (${DB_NAME}) y usuario (${DB_USER})..."
  local escaped_pass
  escaped_pass=$(printf "%q" "${DB_PASS}")

  local sql="
    CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
    GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
    FLUSH PRIVILEGES;
  "
  if mysql_exec "$sql"; then
    log "Base y usuario configurados correctamente."
  else
    warn "No se pudo crear BD/usuario con auth_socket ni con GP_DB_ROOT_PASS."
    warn "Puedes crear la BD/usuario manualmente y re-ejecutar:"
    echo "  CREATE DATABASE \`${DB_NAME}\`;"
    echo "  CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY '********';"
    echo "  GRANT ALL ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost'; FLUSH PRIVILEGES;"
  fi
}

# -------------------------- Prompts (si faltan datos) -----------------------
random_string_hex() {
  # 32 bytes -> 64 hex chars (requiere openssl); fallback simple si no existe
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    dd if=/dev/urandom bs=16 count=1 2>/dev/null | xxd -p -c 64
  fi
}

prompt_missing() {
  if [[ -z "${PUBLIC_HOST}" ]]; then
    read -rp "Dominio/IP pública (ej: 46.202.93.54): " PUBLIC_HOST
  fi
  if [[ -z "${DB_PASS}" ]]; then
    read -rsp "Password de ${DB_USER} (DB): " DB_PASS; echo
  fi
  if [[ -z "${JWT_SECRET}" ]]; then
    JWT_SECRET="$(random_string_hex)"
    log "JWT_SECRET generado automáticamente."
  fi
  # SIIGO puede configurarse luego vía panel; si quieres, pide ahora:
  if [[ -z "${SIIGO_USERNAME}" ]]; then
    read -rp "SIIGO Username (puede dejar vacío y configurar luego): " SIIGO_USERNAME || true
  fi
  if [[ -z "${SIIGO_ACCESS_KEY}" ]]; then
    read -rp "SIIGO Access Key (puede dejar vacío y configurar luego): " SIIGO_ACCESS_KEY || true
  fi
}

# -------------------------- Preparar .env backend ---------------------------
write_backend_env() {
  local env_file="${REPO_PATH}/backend/.env"
  log "Escribiendo backend/.env en ${env_file}"
  cat > "${env_file}" <<ENV
# --- Server ---
PORT=${BACKEND_PORT}
NODE_ENV=production

# --- DB ---
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}
DB_NAME=${DB_NAME}

# --- JWT ---
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=24h

# --- CORS ---
FRONTEND_URL=http://${PUBLIC_HOST}

# --- SIIGO (puede editar luego en panel /config) ---
SIIGO_ENABLED=true
SIIGO_API_USERNAME=${SIIGO_USERNAME}
SIIGO_API_ACCESS_KEY=${SIIGO_ACCESS_KEY}
SIIGO_API_BASE_URL=${SIIGO_BASE_URL}
SIIGO_PARTNER_ID=siigo
SIIGO_WEBHOOK_SECRET=secure-webhook-secret

# --- CHATGPT (opcional; puede dejar vacío) ---
CHATGPT_ENABLED=false
OPENAI_API_KEY=
CHATGPT_MODEL=gpt-4o-mini

# --- Auto Sync SIIGO ---
SIIGO_AUTO_SYNC=false
SIIGO_SYNC_INTERVAL=5
ENV
}

# -------------------------- Backend: deps, migración, PM2 -------------------
setup_backend() {
  log "Instalando dependencias del backend (npm ci --omit=dev)..."
  pushd "${REPO_PATH}/backend" >/dev/null
  npm ci --omit=dev

  # Ejecutar migración portable de ENUMs y tablas necesarias
  if [[ -f "scripts/fix_enums_portable.js" ]]; then
    log "Ejecutando migración portable de BD..."
    node scripts/fix_enums_portable.js || warn "Migración retornó error (revisar credenciales DB y estructura)."
  else
    warn "No se encontró scripts/fix_enums_portable.js"
  fi

  # Levantar con PM2
  if pm2 describe "${PM2_APP}" >/dev/null 2>&1; then
    log "Reiniciando PM2 app ${PM2_APP}..."
    pm2 restart "${PM2_APP}" --update-env
  else
    log "Iniciando PM2 app ${PM2_APP}..."
    pm2 start server.js --name "${PM2_APP}"
  fi

  pm2 save
  # Registrar PM2 para inicio automático
  if command -v systemctl >/dev/null 2>&1; then
    pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
  fi
  popd >/dev/null
}

# -------------------------- Frontend: build y publicar ----------------------
setup_frontend() {
  log "Construyendo frontend (npm ci && npm run build)..."
  pushd "${REPO_PATH}/frontend" >/dev/null
  npm ci
  # En producción, el frontend usa '/api' same-origin por diseño (ver api.js)
  npm run build
  popd >/dev/null

  log "Publicando build de frontend en ${FRONTEND_ROOT} ..."
  mkdir -p "${FRONTEND_ROOT}"
  rsync -a --delete "${REPO_PATH}/frontend/build/" "${FRONTEND_ROOT}/"
  chown -R www-data:www-data "${FRONTEND_ROOT}"
}

# -------------------------- Nginx site --------------------------------------
write_nginx_conf() {
  local backend_port="$1"

  log "Creando Nginx site (${NGINX_SITE_AVAIL}) con backend en puerto ${backend_port} ..."
  cat > "${NGINX_SITE_AVAIL}" <<NGINX
upstream pedidos_backend {
    server 127.0.0.1:${backend_port};
    keepalive 64;
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 20M;

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

    # Estáticos desde backend (uploads)
    location ^~ /uploads/ {
        proxy_pass http://pedidos_backend;
        proxy_http_version 1.1;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
    }

    # Cache de estáticos de frontend
    location ~* \.(?:js|css|woff2?|ttf|eot|ico|svg|gif|jpg|jpeg|png)$ {
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
        try_files \$uri /index.html;
    }
}
NGINX

  ln -sf "${NGINX_SITE_AVAIL}" "${NGINX_SITE_ENABLED}"
  rm -f /etc/nginx/sites-enabled/default || true

  log "Verificando Nginx (nginx -t) ..."
  nginx -t
  log "Recargando Nginx ..."
  systemctl reload nginx
}

# -------------------------- Health checks -----------------------------------
health_checks() {
  hr
  log "Comprobando salud del backend a través de Nginx (http://127.0.0.1/api/health)..."
  if curl -fsS "http://127.0.0.1/api/health" | sed -e 's/.*/[HEALTH] &/'; then
    log "Health OK."
  else
    warn "Health no respondió 200. Revisa:
      - pm2 logs ${PM2_APP} --lines 120 --nostream
      - curl -i http://127.0.0.1:${BACKEND_PORT}/api/health (directo al backend)"
  fi
  hr
  echo "Frontend disponible (si DNS/IP apunta):  http://${PUBLIC_HOST}/"
  echo "API health via Nginx:                   http://${PUBLIC_HOST}/api/health"
  hr
}

# -------------------------- Main --------------------------------------------
main() {
  require_root
  require_ubuntu

  if [[ ! -d "${REPO_PATH}" ]]; then
    err "No existe ${REPO_PATH}. Clona el repo en esa ruta o exporta GP_REPO_PATH."
    exit 1
  fi

  ensure_packages
  prompt_missing
  ensure_database
  write_backend_env
  setup_backend
  setup_frontend
  write_nginx_conf "${BACKEND_PORT}"
  health_checks

  log "Instalación end-to-end completada."
  hr
  echo "Siguientes pasos:"
  echo " - Para ver logs backend: pm2 logs ${PM2_APP} --lines 120 --nostream"
  echo " - Para arrancar al boot: pm2 save (ya ejecutado) y confirmar 'pm2 startup' (ya configurado)"
  echo " - Para actualizar SIIGO credentials: vía API/UI o editar backend/.env y 'pm2 restart ${PM2_APP} --update-env'"
  hr
}

main "$@"
