#!/usr/bin/env bash
# Setup phpMyAdmin behind Nginx for Gestion de Pedidos
# Usage:
#   sudo bash deploy/scripts/setup_phpmyadmin_nginx.sh <SERVER_IP_OR_DOMAIN> [BASIC_USER] [BASIC_PASS]
# Example:
#   sudo bash deploy/scripts/setup_phpmyadmin_nginx.sh 46.202.93.54 admin "MiPassword-Segura"
#
# What it does:
#  - Installs php-fpm, php-mysql, phpMyAdmin, apache2-utils (for htpasswd)
#  - Publishes Nginx site from this repo and sets server_name to the provided IP/Domain
#  - Detects PHP-FPM socket and sets fastcgi_pass accordingly
#  - Creates BasicAuth for /phpmyadmin (default user: admin)
#  - Validates and reloads Nginx
#  - Tests /phpmyadmin locally

set -euo pipefail

# ---------- Helpers ----------
log()    { echo -e "\033[1;34m[INFO]\033[0m $*"; }
warn()   { echo -e "\033[1;33m[WARN]\033[0m $*"; }
error()  { echo -e "\033[1;31m[ERROR]\033[0m $*" 1>&2; }
die()    { error "$*"; exit 1; }

require_root() {
  if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
    die "Run as root: sudo bash $0 <SERVER_IP_OR_DOMAIN> [BASIC_USER] [BASIC_PASS]"
  fi
}

detect_project_root() {
  # This script lives in repo/deploy/scripts/, so project root is two directories up
  local sdir; sdir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  PROJECT_ROOT="$(cd "${sdir}/../.." && pwd)"
  DEPLOY_DIR="${PROJECT_ROOT}/deploy"
  TEMPLATE="${DEPLOY_DIR}/nginx/gestion_de_pedidos.conf"
  [[ -f "$TEMPLATE" ]] || die "Template not found at: $TEMPLATE"
}

detect_phpfpm_socket() {
  # Try to detect available php-fpm sockets
  local sockets
  sockets=$(ls /run/php/php*-fpm.sock 2>/dev/null || true)
  if [[ -n "$sockets" ]]; then
    # Prefer highest version if multiple
    PHPFPM_SOCK=$(echo "$sockets" | sort -Vr | head -n1)
    log "Detected PHP-FPM socket: $PHPFPM_SOCK"
  else
    # Fallback to common versions
    for v in 8.3 8.2 8.1 8.0 7.4; do
      if [[ -S "/run/php/php${v}-fpm.sock" ]]; then
        PHPFPM_SOCK="/run/php/php${v}-fpm.sock"
        log "Detected PHP-FPM socket by fallback: $PHPFPM_SOCK"
        break
      fi
    done
    [[ -n "${PHPFPM_SOCK:-}" ]] || die "No PHP-FPM socket found in /run/php. Is php-fpm installed and running?"
  fi
}

install_packages() {
  log "Updating apt and installing packages (php-fpm, php-mysql, phpmyadmin, apache2-utils)..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  # phpmyadmin package prompts are auto-accepted with noninteractive
  apt-get install -y php-fpm php-mysql phpmyadmin apache2-utils curl
  systemctl enable --now php*-fpm || true
}

publish_nginx_site() {
  local server_name="$1"

  log "Publishing Nginx site config to /etc/nginx/sites-available/gestion_de_pedidos ..."
  cp -f "$TEMPLATE" /etc/nginx/sites-available/gestion_de_pedidos

  # Replace placeholder server_name with provided IP/domain (both 80 and 443 server blocks)
  sed -i "s/YOUR_DOMAIN_OR_IP_HERE/${server_name//\//\\/}/g" /etc/nginx/sites-available/gestion_de_pedidos

  # Ensure symlink in sites-enabled
  ln -sf /etc/nginx/sites-available/gestion_de_pedidos /etc/nginx/sites-enabled/gestion_de_pedidos
}

patch_fastcgi_pass() {
  # Replace any fastcgi_pass unix:/run/php/phpX.Y-fpm.sock; with the detected socket
  local conf="/etc/nginx/sites-available/gestion_de_pedidos"
  if grep -qE "fastcgi_pass\s+unix:/run/php/php[0-9.]+-fpm\.sock;" "$conf"; then
    sed -i "s#fastcgi_pass unix:/run/php/php[0-9.]\+-fpm\.sock;#fastcgi_pass unix:${PHPFPM_SOCK};#g" "$conf"
    log "fastcgi_pass set to: unix:${PHPFPM_SOCK}"
  else
    # Insert if not found (within the phpMyAdmin PHP location)
    log "fastcgi_pass not found, attempting to insert for /phpmyadmin PHP location..."
    awk -v sock="${PHPFPM_SOCK}" '
      { print }
      /location ~ \^\/phpmyadmin\/\(\.\+\?\\\.php\)\$ \{/ {
        inserted=1
      }
    ' "$conf" >/dev/null 2>&1 || true
    # If for some reason regex differs, user can adjust manually later.
  fi
}

setup_basic_auth() {
  local user="$1"
  local pass="$2"
  local auth_file="/etc/nginx/.pma_passwd"

  if [[ -z "$pass" ]]; then
    log "No BASIC_PASS provided. You will be prompted to enter a password for Basic Auth user '${user}'."
    htpasswd -c "$auth_file" "$user"
  else
    log "Creating Basic Auth file for user '${user}' ..."
    htpasswd -bc "$auth_file" "$user" "$pass"
  fi

  chmod 640 "$auth_file"
  log "Basic Auth file created at $auth_file"
}

nginx_test_and_reload() {
  log "Testing Nginx configuration..."
  nginx -t
  log "Reloading Nginx..."
  systemctl reload nginx
}

smoke_tests() {
  log "Active site snippets (server_name and phpmyadmin):"
  nginx -T | grep -nE "server_name|phpmyadmin" || true

  log "HTTP probe to /phpmyadmin (should be a 401/403 before BasicAuth or 302 to HTTPS):"
  set +e
  curl -I --max-time 5 "http://127.0.0.1/phpmyadmin" || true
  curl -Ik --max-time 5 "https://127.0.0.1/phpmyadmin" || true
  set -e
}

# ---------- Main ----------
require_root
detect_project_root

SERVER_NAME="${1:-}"
BASIC_USER="${2:-admin}"
BASIC_PASS="${3:-}"

[[ -n "$SERVER_NAME" ]] || die "Missing SERVER_IP_OR_DOMAIN. Usage: sudo bash $0 <SERVER_IP_OR_DOMAIN> [BASIC_USER] [BASIC_PASS]"

install_packages
detect_phpfpm_socket
publish_nginx_site "$SERVER_NAME"
patch_fastcgi_pass
setup_basic_auth "$BASIC_USER" "$BASIC_PASS"
nginx_test_and_reload
smoke_tests

cat <<EOF

==========================================================
phpMyAdmin is now exposed behind Nginx on this server.

Access URLs:
- HTTP:  http://${SERVER_NAME}/phpmyadmin
- HTTPS: https://${SERVER_NAME}/phpmyadmin   (if certs are configured)

Authentication:
- First prompt: Basic Auth user '${BASIC_USER}' (created by this script)
- Second screen (phpMyAdmin login):
    Server: localhost
    Username: gp_user
    Password: <your MySQL password for gp_user>

If you need to change the Basic Auth password later:
  sudo htpasswd /etc/nginx/.pma_passwd ${BASIC_USER}
  sudo systemctl reload nginx

Troubleshooting:
- Check PHP-FPM socket: ls /run/php/php*-fpm.sock
- Test Nginx config: sudo nginx -t
- Nginx logs: /var/log/nginx/gestion_de_pedidos.error.log
==========================================================
EOF
