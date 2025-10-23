#!/usr/bin/env bash
# End-to-End installer for Gestion de Pedidos (Ubuntu 20.04/22.04+)
# Usage example:
#   sudo GP_PUBLIC_HOST=203.0.113.10 \
#        GP_DB_NAME=gestion_pedidos_dev \
#        GP_DB_USER=gp_user \
#        GP_DB_PASS='cambia_esta_pass' \
#        GP_BRANCH=remote-ssh \
#        bash deploy/install_end_to_end.sh
#
# Notes:
# - If GP_BRANCH is omitted it defaults to 'main'. While the PR merges, use GP_BRANCH=remote-ssh (contains products LIMIT/OFFSET fix).
# - If your MySQL/MariaDB root requires password, set GP_DB_ROOT_PASS. Otherwise auth_socket is used.

set -Eeuo pipefail

log() { echo -e "\033[1;32m[INSTALL]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
err() { echo -e "\033[1;31m[ERROR]\033[0m $*" >&2; }

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    err "Run as root: sudo bash deploy/install_end_to_end.sh"
    exit 1
  fi
}

gen_jwt_secret() {
  head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 48
}

gen_hex_64() {
  openssl rand -hex 32
}

# Defaults (override via env)
GP_PUBLIC_HOST="${GP_PUBLIC_HOST:-$(hostname -I | awk '{print $1}')}"
GP_REPO_PATH="${GP_REPO_PATH:-/var/www/gestion_de_pedidos}"
GP_BRANCH="${GP_BRANCH:-main}"                        # while PR merges, you can set remote-ssh
GP_BACKEND_PORT="${GP_BACKEND_PORT:-3001}"
GP_FRONTEND_ROOT="${GP_FRONTEND_ROOT:-/var/www/gestion-frontend}"

GP_DB_HOST="${GP_DB_HOST:-127.0.0.1}"
GP_DB_PORT="${GP_DB_PORT:-3306}"
GP_DB_NAME="${GP_DB_NAME:-gestion_pedidos_dev}"
GP_DB_USER="${GP_DB_USER:-gp_user}"
GP_DB_PASS="${GP_DB_PASS:-gp_pass_123}"
GP_DB_ROOT_PASS="${GP_DB_ROOT_PASS:-}"

GP_JWT_SECRET="${GP_JWT_SECRET:-$(gen_jwt_secret)}"
GP_CONFIG_ENCRYPTION_KEY="${GP_CONFIG_ENCRYPTION_KEY:-$(gen_hex_64)}"

require_root
log "Installing Gestion de Pedidos on Ubuntu. Host: ${GP_PUBLIC_HOST} Branch: ${GP_BRANCH}"

log "Updating APT and installing base packages..."
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates curl git nginx mariadb-server mariadb-client \
  software-properties-common build-essential

log "Installing Node.js 20.x and PM2..."
if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm install -g pm2@latest

log "Ensuring MariaDB is running..."
systemctl enable mariadb --now

log "Creating database and user if needed..."
SQL_CREATE="
CREATE DATABASE IF NOT EXISTS \`${GP_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${GP_DB_USER}'@'localhost' IDENTIFIED BY '${GP_DB_PASS}';
GRANT ALL PRIVILEGES ON \`${GP_DB_NAME}\`.* TO '${GP_DB_USER}'@'localhost';
FLUSH PRIVILEGES;
"
set +e
if [[ -n "${GP_DB_ROOT_PASS}" ]]; then
  echo "${SQL_CREATE}" | mysql -u root -p"${GP_DB_ROOT_PASS}" 2>/dev/null
  DB_RC=$?
else
  echo "${SQL_CREATE}" | mysql -u root 2>/dev/null
  DB_RC=$?
fi
set -e
if [[ "${DB_RC}" -ne 0 ]]; then
  warn "Unable to run SQL via mysql root. Trying mariadb CLI with socket..."
  echo "${SQL_CREATE}" | mariadb -u root || warn "Could not ensure DB/user. If you use a non-socket root, set GP_DB_ROOT_PASS."
fi

log "Preparing repo directory: ${GP_REPO_PATH}"
mkdir -p "${GP_REPO_PATH}"
if [[ ! -d "${GP_REPO_PATH}/.git" ]]; then
  git clone https://github.com/jecaicedo27/gestion_de_pedidos.git "${GP_REPO_PATH}"
fi
cd "${GP_REPO_PATH}"
git fetch origin
# If specified branch exists remotely, use it. Else fallback to main.
if git ls-remote --exit-code --heads origin "${GP_BRANCH}" >/dev/null 2>&1; then
  git checkout -B "${GP_BRANCH}" "origin/${GP_BRANCH}"
else
  warn "Branch ${GP_BRANCH} not found on remote. Falling back to main."
  git checkout -B main origin/main
  GP_BRANCH="main"
fi

log "Backend dependency install (npm ci --omit=dev)..."
cd backend
npm ci --omit=dev

log "Writing backend/.env (production)..."
cat > .env <<EOF
# --- Server ---
PORT=${GP_BACKEND_PORT}
NODE_ENV=production

# --- DB ---
DB_HOST=${GP_DB_HOST}
DB_PORT=${GP_DB_PORT}
DB_USER=${GP_DB_USER}
DB_PASSWORD=${GP_DB_PASS}
DB_NAME=${GP_DB_NAME}

# --- JWT ---
JWT_SECRET=${GP_JWT_SECRET}
JWT_EXPIRES_IN=24h
CONFIG_ENCRYPTION_KEY=${GP_CONFIG_ENCRYPTION_KEY}

# --- CORS / Frontend ---
FRONTEND_URL=http://${GP_PUBLIC_HOST}

# --- SIIGO ---
SIIGO_ENABLED=true
SIIGO_API_USERNAME=
SIIGO_API_ACCESS_KEY=
SIIGO_API_BASE_URL=https://api.siigo.com
SIIGO_PARTNER_ID=siigo
SIIGO_WEBHOOK_SECRET=secure-webhook-secret

# --- Auto Sync SIIGO ---
SIIGO_AUTO_SYNC=false
SIIGO_SYNC_INTERVAL=5
EOF

log "Running portable schema migrations (if present)..."
if [[ -f scripts/ensure_schema_portable.js ]]; then
  node scripts/ensure_schema_portable.js || warn "ensure_schema_portable.js failed (continuing)"
fi
if [[ -f scripts/ensure_analytics_schema_portable.js ]]; then
  node scripts/ensure_analytics_schema_portable.js || true
fi
if [[ -f scripts/fix_enums_portable.js ]]; then
  node scripts/fix_enums_portable.js || true
fi

log "Starting backend with PM2..."
if pm2 ls | grep -q gestion-backend; then
  pm2 restart gestion-backend --update-env
else
  pm2 start server.js --name gestion-backend --time
fi
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

log "Frontend build and publish..."
cd "${GP_REPO_PATH}/frontend"
npm ci
# In production we use same-origin '/api', so no REACT_APP_API_URL is required
npm run build
mkdir -p "${GP_FRONTEND_ROOT}"
rsync -a --delete build/ "${GP_FRONTEND_ROOT}/"

log "Configuring Nginx site..."
cat > /etc/nginx/sites-available/gestion-pedidos.conf <<'NGINXCONF'
server {
  listen 80;
  listen [::]:80;

  server_name _;

  # Static frontend
  root /var/www/gestion-frontend;
  index index.html;

  # Frontend paths (history API fallback)
  location / {
    try_files $uri /index.html;
  }

  # API proxy
  location /api/ {
    proxy_pass http://127.0.0.1:3001/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";
    client_max_body_size 10m;
  }

  # Socket.IO
  location /socket.io/ {
    proxy_pass http://127.0.0.1:3001/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
NGINXCONF

# Replace backend port in nginx if GP_BACKEND_PORT != 3001
if [[ "${GP_BACKEND_PORT}" != "3001" ]]; then
  sed -i "s/127.0.0.1:3001/127.0.0.1:${GP_BACKEND_PORT}/g" /etc/nginx/sites-available/gestion-pedidos.conf
fi

rm -f /etc/nginx/sites-enabled/default || true
ln -sf /etc/nginx/sites-available/gestion-pedidos.conf /etc/nginx/sites-enabled/gestion-pedidos.conf
nginx -t
systemctl reload nginx

log "Health check via Nginx:"
curl -s -i "http://127.0.0.1/api/health" || true

cat <<EOT

========================================================
✅ Instalación completada

Frontend:  http://${GP_PUBLIC_HOST}/
API Health: http://${GP_PUBLIC_HOST}/api/health

Si ves 502 en /api/health:
  - Verifica puerto real backend: curl -i http://127.0.0.1:${GP_BACKEND_PORT}/api/health
  - Ajusta Nginx si hace falta: /etc/nginx/sites-available/gestion-pedidos.conf

Notas:
- PM2: pm2 logs gestion-backend --lines 120 --nostream
- Para actualizar versión:
    cd ${GP_REPO_PATH}
    git fetch origin
    git checkout -B ${GP_BRANCH} origin/${GP_BRANCH}
    cd backend && npm ci --omit=dev && pm2 restart gestion-backend --update-env
    cd ../frontend && npm ci && npm run build && rsync -a --delete build/ ${GP_FRONTEND_ROOT}/ && systemctl reload nginx
========================================================
EOT
