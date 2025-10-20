#!/usr/bin/env bash
# Provisioning script for a fresh Ubuntu VPS (HTTP only, no SSL)
# - Installs: Nginx, Node.js LTS, PM2, MySQL Server
# - Configures Nginx to serve React build and reverse proxy /api to backend
# - Creates MySQL DB/user
# - Prepares backend .env and frontend .env.production
# - Builds frontend and starts backend with PM2
#
# Usage:
#   chmod +x deploy/provision_http_vps.sh
#   sudo ./deploy/provision_http_vps.sh
#
# Required: the project must be uploaded to /var/www/gestion_de_pedidos (or adjust APP_DIR).
#           This script assumes the repo structure present in that directory.

set -euo pipefail

# ====== CONFIGURABLE VARIABLES ======
APP_DIR="/var/www/gestion_de_pedidos"

# Set your VPS public IP (used for FRONTEND_URL and REACT_APP_API_URL)
SERVER_IP="${SERVER_IP:-$(hostname -I | awk '{print $1}')}"  # auto-detect first IP if not provided

# MySQL settings for application database
APP_DB_NAME="${APP_DB_NAME:-gestion_pedidos}"
APP_DB_USER="${APP_DB_USER:-gp_user}"
APP_DB_PASS="${APP_DB_PASS:-gp_password_segura}"  # CHANGE THIS

# Whether to configure UFW firewall rules (optional)
CONFIGURE_UFW="${CONFIGURE_UFW:-true}"

# Node LTS major version to install (e.g., 20)
NODE_MAJOR="${NODE_MAJOR:-20}"

# ====== HELPER FUNCTIONS ======
info()  { echo -e "\\033[1;34m[INFO]\\033[0m  $*"; }
warn()  { echo -e "\\033[1;33m[WARN]\\033[0m  $*"; }
error() { echo -e "\\033[1;31m[ERROR]\\033[0m $*"; }

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    error "Run as root: sudo $0"
    exit 1
  fi
}

check_ubuntu() {
  if ! command -v apt >/dev/null 2>&1; then
    error "This script expects an Ubuntu/Debian system with apt available."
    exit 1
  fi
}

# ====== START ======
require_root
check_ubuntu

info "Using APP_DIR=${APP_DIR}"
info "Detected/Configured SERVER_IP=${SERVER_IP}"
info "DB: name=${APP_DB_NAME}, user=${APP_DB_USER}"

# 1) System update and base packages
info "Updating system and installing base packages..."
apt-get update -y
apt-get upgrade -y
apt-get install -y curl gnupg2 ca-certificates lsb-release ubuntu-keyring \
                   build-essential git unzip

# 2) Install Nginx
info "Installing Nginx..."
apt-get install -y nginx

# Optional UFW rules
if [[ "${CONFIGURE_UFW}" == "true" ]]; then
  if command -v ufw >/dev/null 2>&1; then
    info "Configuring UFW firewall rules..."
    ufw allow OpenSSH || true
    ufw allow 'Nginx HTTP' || true
    ufw --force enable || true
    ufw status || true
  else
    warn "UFW not installed; skipping firewall configuration."
  fi
fi

# 3) Install Node.js LTS and PM2
info "Installing Node.js LTS v${NODE_MAJOR} and PM2..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash -
apt-get install -y nodejs
node -v
npm -v
npm install -g pm2

# 4) Install MySQL server and create DB/user
info "Installing MySQL Server..."
DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server

info "Configuring MySQL database and user..."
mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`${APP_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${APP_DB_USER}'@'localhost' IDENTIFIED BY '${APP_DB_PASS}';
GRANT ALL PRIVILEGES ON \`${APP_DB_NAME}\`.* TO '${APP_DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

# 5) Prepare application directory
info "Ensuring application directory exists at ${APP_DIR} ..."
mkdir -p "${APP_DIR}"
# The project should already be uploaded to ${APP_DIR}
# You can rsync from your local machine, e.g.:
# rsync -avz --exclude node_modules --exclude .git ./gestion_de_pedidos/ user@${SERVER_IP}:${APP_DIR}/

# 6) Configure Nginx (HTTP only) to serve frontend and proxy backend
NGINX_SITE_SRC="${APP_DIR}/deploy/nginx/gestion_de_pedidos_http.conf"
NGINX_SITE_DST="/etc/nginx/sites-available/gestion_de_pedidos"
if [[ -f "${NGINX_SITE_SRC}" ]]; then
  info "Installing Nginx site from ${NGINX_SITE_SRC} ..."
  cp -f "${NGINX_SITE_SRC}" "${NGINX_SITE_DST}"
  ln -sf "${NGINX_SITE_DST}" "/etc/nginx/sites-enabled/gestion_de_pedidos"
  nginx -t
  systemctl reload nginx
else
  warn "Nginx HTTP site config not found at ${NGINX_SITE_SRC}. Skipping Nginx setup."
fi

# 7) Backend environment
cd "${APP_DIR}"
if [[ ! -f "${APP_DIR}/backend/.env" ]]; then
  info "Creating backend .env from template..."
  cp "${APP_DIR}/backend/.env.production.example" "${APP_DIR}/backend/.env" 2>/dev/null || cp "${APP_DIR}/backend/.env.example" "${APP_DIR}/backend/.env"

  # Generate secrets
  JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")"
  CONFIG_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"

  # Replace key values in .env
  sed -i "s|^DB_HOST=.*|DB_HOST=localhost|g" "${APP_DIR}/backend/.env"
  sed -i "s|^DB_PORT=.*|DB_PORT=3306|g" "${APP_DIR}/backend/.env"
  sed -i "s|^DB_USER=.*|DB_USER=${APP_DB_USER}|g" "${APP_DIR}/backend/.env"
  sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${APP_DB_PASS}|g" "${APP_DIR}/backend/.env"
  sed -i "s|^DB_NAME=.*|DB_NAME=${APP_DB_NAME}|g" "${APP_DIR}/backend/.env"

  # FRONTEND_URL should be HTTP with IP since no SSL/domain
  if grep -q "^FRONTEND_URL=" "${APP_DIR}/backend/.env"; then
    sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=http://${SERVER_IP}|g" "${APP_DIR}/backend/.env"
  else
    echo "FRONTEND_URL=http://${SERVER_IP}" >> "${APP_DIR}/backend/.env"
  fi

  # JWT and encryption key
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|g" "${APP_DIR}/backend/.env"
  sed -i "s|^CONFIG_ENCRYPTION_KEY=.*|CONFIG_ENCRYPTION_KEY=${CONFIG_KEY}|g" "${APP_DIR}/backend/.env"
else
  warn "backend/.env already exists. Skipping creation."
fi

# 8) Install backend dependencies and run migrations
info "Installing backend dependencies..."
npm --prefix backend ci

info "Applying database migrations (if applicable)..."
if [[ -f "${APP_DIR}/database/migrate.js" ]]; then
  node database/migrate.js || warn "migrate.js returned non-zero or not required."
else
  warn "database/migrate.js not found. Skipping migration step."
fi

# 9) Start backend with PM2
info "Starting backend with PM2..."
if [[ -f "${APP_DIR}/ecosystem.config.js" ]]; then
  pm2 start "${APP_DIR}/ecosystem.config.js" --env production
else
  # fallback: run server.js directly
  pm2 start backend/server.js --name gestion-backend --update-env --time
fi
pm2 save
pm2 startup systemd -u "$(logname)" --hp "/home/$(logname)" >/dev/null 2>&1 || true

# 10) Frontend environment and build
if [[ ! -f "${APP_DIR}/frontend/.env.production" ]]; then
  info "Creating frontend .env.production ..."
  if [[ -f "${APP_DIR}/frontend/.env.production.example" ]]; then
    cp "${APP_DIR}/frontend/.env.production.example" "${APP_DIR}/frontend/.env.production"
  else
    touch "${APP_DIR}/frontend/.env.production"
  fi
  sed -i "s|^REACT_APP_API_URL=.*|REACT_APP_API_URL=http://${SERVER_IP}/api|g" "${APP_DIR}/frontend/.env.production"
else
  warn "frontend/.env.production already exists. Skipping creation."
fi

info "Installing frontend dependencies and building production assets..."
npm --prefix frontend ci
npm --prefix frontend run build

# Ensure Nginx can read static build files
chown -R www-data:www-data "${APP_DIR}/frontend/build" || true

# 11) Final checks
info "Nginx status:"
systemctl status nginx --no-pager || true

info "PM2 processes:"
pm2 ls || true

info "Try hitting:"
echo "  Frontend:      http://${SERVER_IP}"
echo "  Public config: http://${SERVER_IP}/api/config/public"
echo
info "Provisioning completed successfully."
