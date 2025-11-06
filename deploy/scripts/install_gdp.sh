#!/usr/bin/env bash
# Scalable installer for "Gestion de Pedidos" (Ubuntu 20.04/22.04+)
# Installs: Nginx, MariaDB (MySQL), Node.js (20.x), PM2, clones repo, builds frontend,
# starts backend, configures Nginx reverse proxy. Optional: phpMyAdmin, BasicAuth, UFW.
#
# Usage (env-driven, all parameters optional):
#   sudo \
#     GP_PUBLIC_HOST=72.60.175.159 \
#     GP_BRANCH=main \
#     GP_REPO_PATH=/var/www/gestion_de_pedidos \
#     GP_FRONTEND_ROOT=/var/www/gestion-frontend \
#     GP_BACKEND_PORT=3001 \
#     GP_DB_HOST=127.0.0.1 \
#     GP_DB_PORT=3306 \
#     GP_DB_NAME=gestion_pedidos \
#     GP_DB_USER=gp_user \
#     GP_DB_PASS='cambia_esta_pass' \
#     GP_DB_ROOT_PASS='' \
#     GP_WITH_PHPMYADMIN=1 \
#     GP_PHPMYADMIN_BASICAUTH=1 \
#     GP_BASIC_USER=admin \
#     GP_BASIC_PASS='MiPassword-Segura' \
#     GP_SETUP_UFW=1 \
#     bash deploy/scripts/install_gdp.sh
#
# Notes:
# - Idempotent: safe to re-run (pulls repo, keeps PM2 name "gestion-backend")
# - If mysql root requires password, set GP_DB_ROOT_PASS; otherwise socket auth is used.
# - For multi-servers, just export different env vars per host and run.

set -Eeuo pipefail

log() { echo -e "\033[1;32m[INSTALL]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
err() { echo -e "\033[1;31m[ERROR]\033[0m $*" >&2; }

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    err "Run as root: sudo bash deploy/scripts/install_gdp.sh (use env vars to configure)"
    exit 1
  fi
}

gen_jwt_secret() { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 48; }
gen_hex_64()     { openssl rand -hex 32; }

# -------- Defaults (override via environment) --------
GP_PUBLIC_HOST="${GP_PUBLIC_HOST:-$(hostname -I | awk '{print $1}')}"
GP_REPO_URL="${GP_REPO_URL:-https://github.com/jecaicedo27/gestion_de_pedidos.git}"
GP_REPO_PATH="${GP_REPO_PATH:-/var/www/gestion_de_pedidos}"
GP_BRANCH="${GP_BRANCH:-main}"
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

# Optional features
GP_WITH_PHPMYADMIN="${GP_WITH_PHPMYADMIN:-0}"         # 1 to install phpMyAdmin
GP_PHPMYADMIN_BASICAUTH="${GP_PHPMYADMIN_BASICAUTH:-0}" # 1 to protect /phpmyadmin with BasicAuth
GP_BASIC_USER="${GP_BASIC_USER:-admin}"
GP_BASIC_PASS="${GP_BASIC_PASS:-admin123}"
GP_SETUP_UFW="${GP_SETUP_UFW:-0}"

require_root
log "Starting scalable install. Host: ${GP_PUBLIC_HOST}  Branch: ${GP_BRANCH}"

# -------- Base packages --------
log "Updating APT and installing base packages (nginx, mariadb, git, build tools)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y \
  ca-certificates curl git nginx mariadb-server mariadb-client \
  software-properties-common build-essential

# Optional: phpMyAdmin and PHP-FPM
PHPFPM_SOCK=""
if [[ "${GP_WITH_PHPMYADMIN}" == "1" ]]; then
  log "Installing phpMyAdmin stack (php-fpm, php-mysql, phpmyadmin, apache2-utils)..."
  apt-get install -y php-fpm php-mysql phpmyadmin apache2-utils
  systemctl enable --now php*-fpm || true

  # Detect PHP-FPM socket
  sockets=$(ls /run/php/php*-fpm.sock 2>/dev/null || true)
  if [[ -n "${sockets}" ]]; then
    PHPFPM_SOCK=$(echo "${sockets}" | sort -Vr | head -n1)
    log "Detected PHP-FPM socket: ${PHPFPM_SOCK}"
  else
    for v in 8.3 8.2 8.1 8.0 7.4; do
      if [[ -S "/run/php/php${v}-fpm.sock" ]]; then
        PHPFPM_SOCK="/run/php/php${v}-fpm.sock"
        log "Detected PHP-FPM socket: ${PHPFPM_SOCK}"
        break
      fi
    done
    [[ -n "${PHPFPM_SOCK}" ]] || warn "Could not detect PHP-FPM socket; phpMyAdmin PHP may not work until php-fpm is up."
  fi
fi

# -------- Node.js 20 + PM2 --------
log "Installing Node.js 20.x and PM2..."
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  log "Node present: $(node -v)"
fi
npm install -g pm2@latest

# -------- MariaDB --------
log "Ensuring MariaDB is enabled and running..."
systemctl enable mariadb --now

log "Creating database/user if not present..."
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
  warn "mysql root failed; trying mariadb socket auth..."
  echo "${SQL_CREATE}" | mariadb -u root || warn "Could not ensure DB/user. Set GP_DB_ROOT_PASS if root has password."
fi

# -------- Repo checkout --------
log "Preparing repo directory at: ${GP_REPO_PATH}"
mkdir -p "${GP_REPO_PATH}"
if [[ ! -d "${GP_REPO_PATH}/.git" ]]; then
  git clone "${GP_REPO_URL}" "${GP_REPO_PATH}"
fi
cd "${GP_REPO_PATH}"
git fetch origin

if git ls-remote --exit-code --heads origin "${GP_BRANCH}" >/dev/null 2>&1; then
  git checkout -B "${GP_BRANCH}" "origin/${GP_BRANCH}"
else
  warn "Branch ${GP_BRANCH} not found; falling back to main."
  git checkout -B main origin/main
  GP_BRANCH="main"
fi

# -------- Backend install --------
log "Installing backend dependencies (omit dev)..."
cd backend
# Prefer reproducible installs; fallback to npm install if lock missing
if [[ -f package-lock.json ]]; then
  npm ci --omit=dev
else
  npm install --omit=dev
fi

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

# Optional portable schema migrations if they exist
if [[ -f scripts/ensure_schema_portable.js ]]; then
  node scripts/ensure_schema_portable.js || warn "ensure_schema_portable.js failed (continuing)"
fi
if [[ -f scripts/ensure_analytics_schema_portable.js ]]; then
  node scripts/ensure_analytics_schema_portable.js || true
fi
if [[ -f scripts/fix_enums_portable.js ]]; then
  node scripts/fix_enums_portable.js || true
fi

log "Starting backend via PM2..."
if pm2 ls | grep -q gestion-backend; then
  pm2 restart gestion-backend --update-env
else
  pm2 start server.js --name gestion-backend --time
fi
pm2 save || true
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

# -------- Frontend build --------
log "Building frontend and publishing static files..."
cd "${GP_REPO_PATH}/frontend"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi
npm run build
mkdir -p "${GP_FRONTEND_ROOT}"
rsync -a --delete build/ "${GP_FRONTEND_ROOT}/"

# -------- Nginx config --------
log "Writing Nginx site configuration..."
SITE="/etc/nginx/sites-available/gestion-pedidos.conf"
cat > "${SITE}" <<'NGINXCONF'
server {
  listen 80;
  listen [::]:80;

  server_name _;

  # Static frontend
  root /var/www/gestion-frontend;
  index index.html;

  # Frontend SPA fallback
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
    proxy_read_timeout 300;
    proxy_connect_timeout 60;
    proxy_send_timeout 60;
  }

  # Socket.IO (WebSockets)
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

  # --- phpMyAdmin (optional blocks appended below) ---
  # PLACEHOLDER_PHPMYADMIN_BLOCK
}
NGINXCONF

# Replace server_name if GP_PUBLIC_HOST provided
if [[ -n "${GP_PUBLIC_HOST}" ]]; then
  sed -i "s/server_name _;/server_name ${GP_PUBLIC_HOST};/g" "${SITE}"
fi

# Replace backend port if different
if [[ "${GP_BACKEND_PORT}" != "3001" ]]; then
  sed -i "s/127.0.0.1:3001/127.0.0.1:${GP_BACKEND_PORT}/g" "${SITE}"
fi

# Append phpMyAdmin blocks if requested
if [[ "${GP_WITH_PHPMYADMIN}" == "1" ]]; then
  log "Adding phpMyAdmin locations to Nginx site..."
  PHPMY_BLOCK=$(cat <<'EOFPM'
  # phpMyAdmin redirect without trailing slash
  location = /phpmyadmin {
    return 302 /phpmyadmin/;
  }

  # Serve phpMyAdmin via root and fastcgi
  location /phpmyadmin/ {
    root /usr/share/;
    index phpmyadmin/index.php index.php;

    # Optional BasicAuth
    # PLACEHOLDER_BASICAUTH
  }

  location ~ ^/phpmyadmin/.+\.php$ {
    root /usr/share/;
    include snippets/fastcgi-php.conf;
    fastcgi_pass unix:FASTCGI_SOCK;
  }

  location ~* ^/phpmyadmin/(.+\.(?:css|js|jpg|jpeg|png|gif|ico|svg|ttf|woff|woff2))$ {
    root /usr/share/;
    access_log off;
    expires 30d;
  }
EOFPM
)
  # Inject block
  sed -i "s|# --- phpMyAdmin (optional blocks appended below) ---\n  # PLACEHOLDER_PHPMYADMIN_BLOCK|${PHPMY_BLOCK//$'\n'/'\n'}|g" "${SITE}"

  # Replace fastcgi socket placeholder if detected
  if [[ -n "${PHPFPM_SOCK}" ]]; then
    sed -i "s|fastcgi_pass unix:FASTCGI_SOCK;|fastcgi_pass unix:${PHPFPM_SOCK};|g" "${SITE}"
  else
    warn "PHP-FPM socket not detected; leaving FASTCGI_SOCK placeholder (phpMyAdmin PHP may not execute)."
  fi

  # Optional BasicAuth for /phpmyadmin/
  if [[ "${GP_PHPMYADMIN_BASICAUTH}" == "1" ]]; then
    log "Enabling BasicAuth for /phpmyadmin (user: ${GP_BASIC_USER})..."
    HTPASS_FILE="/etc/nginx/.htpasswd_phpmyadmin"
    # Create or update password file
    if command -v htpasswd >/dev/null 2>&1; then
      if [[ -f "${HTPASS_FILE}" ]]; then
        htpasswd -b "${HTPASS_FILE}" "${GP_BASIC_USER}" "${GP_BASIC_PASS}" >/dev/null 2>&1 || true
      else
        htpasswd -bc "${HTPASS_FILE}" "${GP_BASIC_USER}" "${GP_BASIC_PASS}" >/dev/null 2>&1 || true
      fi
    else
      warn "apache2-utils/htpasswd not available; cannot configure BasicAuth."
    fi
    # Inject auth directives
    sed -i 's|# PLACEHOLDER_BASICAUTH|auth_basic "Restricted";\n    auth_basic_user_file /etc/nginx/.htpasswd_phpmyadmin;|g' "${SITE}"
  else
    # Remove placeholder if not used
    sed -i 's|# PLACEHOLDER_BASICAUTH||g' "${SITE}"
  fi
else
  # Remove placeholder entirely
  sed -i 's|# --- phpMyAdmin (optional blocks appended below) ---\n  # PLACEHOLDER_PHPMYADMIN_BLOCK||g' "${SITE}"
fi

rm -f /etc/nginx/sites-enabled/default || true
ln -sf "${SITE}" /etc/nginx/sites-enabled/gestion-pedidos.conf
nginx -t
systemctl reload nginx

# -------- Optional: UFW firewall --------
if [[ "${GP_SETUP_UFW}" == "1" ]]; then
  log "Configuring UFW firewall (OpenSSH + Nginx Full)..."
  apt-get install -y ufw
  ufw allow OpenSSH
  ufw allow 'Nginx Full'
  yes | ufw enable || true
  ufw status || true
fi

# -------- Health checks --------
log "Health check via Nginx:"
set +e
curl -s -i "http://127.0.0.1/api/health" | head -n 1 || true
set -e

cat <<EOT

========================================================
✅ Installation completed

Frontend:   http://${GP_PUBLIC_HOST}/
API Health: http://${GP_PUBLIC_HOST}/api/health

PM2:
  pm2 status
  pm2 logs gestion-backend --lines 120 --nostream
  pm2 restart gestion-backend

Deploy update (later):
  cd ${GP_REPO_PATH}
  git fetch origin
  git checkout -B ${GP_BRANCH} origin/${GP_BRANCH}
  cd backend && npm ci --omit=dev && pm2 restart gestion-backend --update-env
  cd ../frontend && npm ci && npm run build && rsync -a --delete build/ ${GP_FRONTEND_ROOT}/ && systemctl reload nginx

phpMyAdmin:
  ${GP_WITH_PHPMYADMIN:+Enabled at http://${GP_PUBLIC_HOST}/phpmyadmin}
  ${GP_PHPMYADMIN_BASICAUTH:+BasicAuth user ${GP_BASIC_USER}}

Security:
  Consider enabling HTTPS (certbot) and restricting phpMyAdmin to BasicAuth or IP allowlist.
========================================================
EOT
