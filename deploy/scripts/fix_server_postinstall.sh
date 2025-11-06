#!/usr/bin/env bash
# Post-install fix script for Gestion de Pedidos
# - Reconfigures Nginx site to include phpMyAdmin locations
# - Optionally installs phpMyAdmin + PHP-FPM and protects with BasicAuth
# - Restarts services and runs quick health checks
# - Optionally runs DB bootstrap to ensure admin user exists
#
# Usage (as root):
#   sudo \
#     PUBLIC_HOST=72.60.175.159 \
#     BACKEND_PORT=3001 \
#     REPO_PATH=/var/www/gestion_de_pedidos \
#     FRONTEND_ROOT=/var/www/gestion-frontend \
#     PHPMYADMIN=1 \
#     BASICAUTH=1 \
#     BASIC_USER=admin \
#     BASIC_PASS='MiPassword-Segura' \
#     DB_NAME=gestion_pedidos_dev \
#     DB_USER=gp_user \
#     DB_PASS='UnaClaveFuerte123!' \
#     bash deploy/scripts/fix_server_postinstall.sh
#
# Safe to re-run.

set -Eeuo pipefail

log() { echo -e "\033[1;32m[FIX]\033[0m $*"; }
warn(){ echo -e "\033[1;33m[WARN]\033[0m $*"; }
err() { echo -e "\033[1;31m[ERROR]\033[0m $*" >&2; }

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    err "Run as root: sudo bash deploy/scripts/fix_server_postinstall.sh"
    exit 1
  fi
}

require_root

PUBLIC_HOST="${PUBLIC_HOST:-$(hostname -I | awk '{print $1}')}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
REPO_PATH="${REPO_PATH:-/var/www/gestion_de_pedidos}"
FRONTEND_ROOT="${FRONTEND_ROOT:-/var/www/gestion-frontend}"

PHPMYADMIN="${PHPMYADMIN:-0}"     # 1 to ensure phpMyAdmin is installed and configured
BASICAUTH="${BASICAUTH:-0}"       # 1 to protect /phpmyadmin
BASIC_USER="${BASIC_USER:-admin}"
BASIC_PASS="${BASIC_PASS:-admin123}"

DB_NAME="${DB_NAME:-gestion_pedidos_dev}"
DB_USER="${DB_USER:-gp_user}"
DB_PASS="${DB_PASS:-gp_pass_123}"

log "Fixing server for host=${PUBLIC_HOST} backend_port=${BACKEND_PORT} repo=${REPO_PATH}"

export DEBIAN_FRONTEND=noninteractive

# Ensure base packages
log "Ensuring Nginx and MariaDB are installed and running..."
apt-get update -y
apt-get install -y nginx mariadb-server mariadb-client curl
systemctl enable --now nginx
systemctl enable --now mariadb || true

PHPFPM_SOCK=""
if [[ "${PHPMYADMIN}" == "1" ]]; then
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
    [[ -n "${PHPFPM_SOCK}" ]] || warn "Could not detect PHP-FPM socket; php files may not execute until php-fpm is up."
  fi
fi

SITE="/etc/nginx/sites-available/gestion-pedidos.conf"

# Write site config (overwrites to ensure phpMyAdmin locations exist)
log "Writing Nginx site to ${SITE} ..."
cat > "${SITE}" <<NGX
server {
  listen 80;
  listen [::]:80;

  server_name ${PUBLIC_HOST};

  # Static frontend
  root ${FRONTEND_ROOT};
  index index.html;

  # SPA fallback
  location / {
    try_files \$uri /index.html;
  }

  # API proxy
  location /api/ {
    proxy_pass http://127.0.0.1:${BACKEND_PORT}/api/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Connection "";
    client_max_body_size 10m;
    proxy_read_timeout 300;
    proxy_connect_timeout 60;
    proxy_send_timeout 60;
  }

  # Socket.IO (WebSockets)
  location /socket.io/ {
    proxy_pass http://127.0.0.1:${BACKEND_PORT}/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
NGX

if [[ "${PHPMYADMIN}" == "1" ]]; then
  cat >> "${SITE}" <<'NGX'
  # phpMyAdmin redirect without trailing slash
  location = /phpmyadmin {
    return 302 /phpmyadmin/;
  }

  # Serve phpMyAdmin via root and fastcgi
  location /phpmyadmin/ {
    root /usr/share/;
    index phpmyadmin/index.php index.php;
NGX

  if [[ "${BASICAUTH}" == "1" ]]; then
    HTPASS_FILE="/etc/nginx/.htpasswd_phpmyadmin"
    log "Configuring BasicAuth for /phpmyadmin (user=${BASIC_USER}) ..."
    if command -v htpasswd >/dev/null 2>&1; then
      if [[ -f "${HTPASS_FILE}" ]]; then
        htpasswd -b "${HTPASS_FILE}" "${BASIC_USER}" "${BASIC_PASS}" >/dev/null 2>&1 || true
      else
        htpasswd -bc "${HTPASS_FILE}" "${BASIC_USER}" "${BASIC_PASS}" >/dev/null 2>&1 || true
      fi
    else
      warn "apache2-utils missing; cannot create htpasswd (installing now)"
      apt-get install -y apache2-utils
      htpasswd -bc "${HTPASS_FILE}" "${BASIC_USER}" "${BASIC_PASS}" >/dev/null 2>&1 || true
    fi
    echo '    auth_basic "Restricted";' >> "${SITE}"
    echo '    auth_basic_user_file /etc/nginx/.htpasswd_phpmyadmin;' >> "${SITE}"
  fi

  cat >> "${SITE}" <<'NGX'
  }

  location ~ ^/phpmyadmin/.+\.php$ {
    root /usr/share/;
    include snippets/fastcgi-php.conf;
NGX

  if [[ -n "${PHPFPM_SOCK}" ]]; then
    echo "    fastcgi_pass unix:${PHPFPM_SOCK};" >> "${SITE}"
  else
    echo "    # fastcgi_pass unix:/run/php/php-fpm.sock;  # placeholder if not detected" >> "${SITE}"
  fi

  cat >> "${SITE}" <<'NGX'
  }

  location ~* ^/phpmyadmin/(.+\.(?:css|js|jpg|jpeg|png|gif|ico|svg|ttf|woff|woff2))$ {
    root /usr/share/;
    access_log off;
    expires 30d;
  }
NGX
fi

# Close server block
echo "}" >> "${SITE}"

rm -f /etc/nginx/sites-enabled/default || true
ln -sf "${SITE}" /etc/nginx/sites-enabled/gestion-pedidos.conf

log "Testing Nginx configuration..."
nginx -t
systemctl reload nginx

log "Quick checks:"
echo "  - Nginx server_name lines:"
nginx -T | grep -nE "server_name" || true

if [[ "${PHPMYADMIN}" == "1" ]]; then
  echo "  - Checking /usr/share/phpmyadmin path:"
  test -d /usr/share/phpmyadmin && echo "    phpmyadmin exists" || echo "    phpmyadmin missing"
  echo "  - HEAD http://127.0.0.1/phpmyadmin/:"
  curl -sS -I http://127.0.0.1/phpmyadmin/ | head -n 1 || true
fi

# Optional DB bootstrap to ensure admin user
if [[ -d "${REPO_PATH}" && -f "${REPO_PATH}/deploy/scripts/bootstrap_db_siigo_admin.sh" ]]; then
  log "Running DB bootstrap (ensure admin user) on DB ${DB_NAME} ..."
  (cd "${REPO_PATH}" && bash deploy/scripts/bootstrap_db_siigo_admin.sh "${DB_NAME}") || warn "DB bootstrap reported warnings."
else
  warn "Bootstrap script not found at ${REPO_PATH}/deploy/scripts/bootstrap_db_siigo_admin.sh; skipping admin user ensure."
fi

# Backend API health
log "API Health via Nginx:"
curl -sS -i "http://127.0.0.1/api/health" | head -n 10 || true

log "Done. If login still shows 500 on /api/auth/login, check PM2 logs:"
echo "  pm2 logs gestion-backend --lines 120 --nostream"
