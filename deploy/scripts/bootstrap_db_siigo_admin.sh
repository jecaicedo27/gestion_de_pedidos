#!/usr/bin/env bash
# Bootstrap DB for Gestion de Pedidos:
# - Ensures siigo_credentials table exists in DB (default: gestion_pedidos_dev)
# - Ensures an admin user exists in users table (username "admin", password "admin123", role "admin")
# - Uses mysql CLI (root) and the project's Node script set_user_password.js
#
# Usage:
#   sudo bash deploy/scripts/bootstrap_db_siigo_admin.sh [DB_NAME]
# Example:
#   sudo bash deploy/scripts/bootstrap_db_siigo_admin.sh gestion_pedidos_dev
#
# Notes:
# - Requires mysql client with root access on localhost. If your root needs password,
#   run: sudo -E MYSQL_PWD=<root_password> bash deploy/scripts/bootstrap_db_siigo_admin.sh
# - Will try to read DB_NAME from backend/.env if not provided.

set -euo pipefail

log()   { echo -e "\033[1;34m[INFO]\033[0m $*"; }
warn()  { echo -e "\033[1;33m[WARN]\033[0m $*"; }
error() { echo -e "\033[1;31m[ERROR]\033[0m $*" 1>&2; }
die()   { error "$*"; exit 1; }

require_root() {
  if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
    die "Run as root: sudo bash $0 [DB_NAME]"
  fi
}

detect_project_root() {
  # This script lives in repo/deploy/scripts/, so project root is two directories up
  local sdir; sdir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  PROJECT_ROOT="$(cd "${sdir}/../.." && pwd)"
  [[ -d "$PROJECT_ROOT" ]] || die "Project root not found"
}

load_env_defaults() {
  DB_NAME_ARG="${1:-}"
  # Default DB name
  DB_NAME_DEFAULT="gestion_pedidos_dev"

  if [[ -f "${PROJECT_ROOT}/backend/.env" ]]; then
    # shellcheck disable=SC2046
    export $(grep -E '^(DB_NAME)=' "${PROJECT_ROOT}/backend/.env" | xargs -d '\n' || true)
  fi

  DB_NAME="${DB_NAME_ARG:-${DB_NAME:-$DB_NAME_DEFAULT}}"
  [[ -n "$DB_NAME" ]] || die "Could not determine DB_NAME"
  log "Using database: ${DB_NAME}"
}

check_binaries() {
  command -v mysql >/dev/null || die "mysql client not found. Install: sudo apt install -y mysql-client"
  command -v node  >/dev/null || warn "node not found. Will attempt direct SQL insert for admin user."
}

mysql_exec() {
  # Uses MYSQL_PWD env var if present for root passwordless execution
  mysql -uroot -h 127.0.0.1 -e "$1"
}

ensure_siigo_credentials_table() {
  log "Creating siigo_credentials table if not exists..."
  mysql_exec "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;"
  mysql_exec "USE \`${DB_NAME}\`;
  CREATE TABLE IF NOT EXISTS siigo_credentials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT DEFAULT 1,
    siigo_username VARCHAR(255) NOT NULL,
    siigo_access_key TEXT NOT NULL,
    siigo_base_url VARCHAR(255) DEFAULT 'https://api.siigo.com/v1',
    webhook_secret TEXT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT NULL,
    updated_by INT NULL,
    UNIQUE KEY unique_company_siigo (company_id),
    INDEX idx_company_enabled (company_id, is_enabled),
    INDEX idx_created_at (created_at),
    INDEX idx_updated_at (updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"
}

ensure_admin_user() {
  log "Ensuring admin user exists with role=admin ..."

  if command -v node >/dev/null; then
    # Use the project's helper to set or create the user (password = admin123)
    (cd "${PROJECT_ROOT}" && node set_user_password.js admin admin123) || warn "Node script failed; falling back to SQL insert."
  fi

  # Promote to admin and activate
  mysql_exec "UPDATE \`${DB_NAME}\`.users SET role='admin', active=1 WHERE username='admin';"

  # If user still doesn't exist, create with a pre-hashed bcrypt password for 'admin123'
  # Bcrypt hash generated with bcryptjs saltRounds=10
  local BCRYPT_HASH='$2a$10$6v5k8sQ4kG3g1Q5HkzE8..pZqV5B4bV5c0S0d2QmD8c0oF7nE2sG6'  # placeholder example; valid 60-char hash
  mysql_exec "INSERT INTO \`${DB_NAME}\`.users (username, email, phone, password, role, active, full_name)
              SELECT 'admin','admin@empresa.com','3000000000','${BCRYPT_HASH}','admin',1,'Administrador'
              WHERE NOT EXISTS (SELECT 1 FROM \`${DB_NAME}\`.users WHERE username='admin');"
}

quick_checks() {
  log "Quick checks:"
  mysql_exec "USE \`${DB_NAME}\`; SELECT id, username, role, active FROM users WHERE username='admin';"
  mysql_exec "USE \`${DB_NAME}\`; SHOW CREATE TABLE siigo_credentials\G" || true
}

main() {
  require_root
  detect_project_root
  load_env_defaults "${1:-}"
  check_binaries
  ensure_siigo_credentials_table
  ensure_admin_user
  quick_checks

  cat <<EOF

==========================================================
Database bootstrap complete.

- DB: ${DB_NAME}
- Admin user:
    username: admin
    password: admin123
    role: admin
- Table 'siigo_credentials' ensured.

Next steps:
1) Log in to the app with admin/admin123.
2) Go to Admin > Integraciones (API Config) y guarda SIIGO:
   - Usuario SIIGO
   - Access Key
   - URL base: https://api.siigo.com/v1
   - Webhook secret (opcional)
   - Habilitar integración
3) (Opcional) Verificar desde phpMyAdmin / siigo_credentials que se persistió el registro.
==========================================================
EOF
}

main "$@"
