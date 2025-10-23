#!/usr/bin/env bash
# reinicio_gold.sh - Reinicio completo y verificación integral (backend, frontend, SIIGO, puertos)
# Uso:
#   sudo bash deploy/scripts/reinicio_gold.sh
# Opcional (credenciales de admin para login API):
#   sudo GP_ADMIN_USER=admin GP_ADMIN_PASS=admin123 bash deploy/scripts/reinicio_gold.sh

set -Eeuo pipefail

# -------------------------
# Configuración y utilidades
# -------------------------
REPO_DIR="/var/www/gestion_de_pedidos"
BACKEND_DIR="${REPO_DIR}/backend"
FRONTEND_DIR="${REPO_DIR}/frontend"
FRONT_PUBLISH_DIR="/var/www/gestion-frontend"

ADMIN_USER="${GP_ADMIN_USER:-admin}"
ADMIN_PASS="${GP_ADMIN_PASS:-admin123}"

C_RESET=$'\033[0m'; C_OK=$'\033[1;32m'; C_WARN=$'\033[1;33m'; C_ERR=$'\033[1;31m'; C_INFO=$'\033[1;36m'

ok()   { echo "${C_OK}[OK]${C_RESET} $*"; }
warn() { echo "${C_WARN}[WARN]${C_RESET} $*"; }
err()  { echo "${C_ERR}[ERROR]${C_RESET} $*" >&2; }
info() { echo "${C_INFO}[INFO]${C_RESET} $*"; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || err "Comando requerido no encontrado: $1"
}

# HTTP status helper
http_status() {
  local url="$1"
  curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000"
}

# Extraer clave simple KEY=VAL (sin export) desde backend/.env
get_env_val() {
  local key="$1"
  local val=""
  if [[ -f "${BACKEND_DIR}/.env" ]]; then
    val="$(grep -E "^${key}=" "${BACKEND_DIR}/.env" | head -n1 | cut -d= -f2- || true)"
    # quitar posibles comillas
    val="${val%\"}"; val="${val#\"}"
    val="${val%\'}"; val="${val#\'}"
  fi
  echo "$val"
}

# Token extractor (jq si existe, si no sed)
get_token() {
  local user="$1" pass="$2"
  local login_json
  login_json="$(curl -s -H "Content-Type: application/json" -X POST -d "{\"username\":\"${user}\",\"password\":\"${pass}\"}" "http://127.0.0.1/api/auth/login" || true)"
  if command -v jq >/dev/null 2>&1; then
    echo "$login_json" | jq -r '.data.token // empty'
  else
    echo "$login_json" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p'
  fi
}

# ---------------
# Chequeo previo
# ---------------
need_cmd git
need_cmd curl
need_cmd node
need_cmd npm
need_cmd pm2
need_cmd systemctl

# Asegurar jq para parsear JSON (opcional)
if ! command -v jq >/dev/null 2>&1; then
  info "Instalando jq..."
  apt-get update -y >/dev/null 2>&1 || true
  apt-get install -y jq >/dev/null 2>&1 || true
fi

# Leer configuración desde .env si existe
BACKEND_PORT="$(get_env_val PORT)"
DB_HOST="$(get_env_val DB_HOST)"
DB_PORT="$(get_env_val DB_PORT)"
DB_USER="$(get_env_val DB_USER)"
DB_PASS="$(get_env_val DB_PASSWORD)"
DB_NAME="$(get_env_val DB_NAME)"

[[ -z "${BACKEND_PORT}" ]] && BACKEND_PORT="3001"
[[ -z "${DB_HOST}" ]] && DB_HOST="127.0.0.1"
[[ -z "${DB_PORT}" ]] && DB_PORT="3306"
[[ -z "${DB_USER}" ]] && DB_USER="root"
[[ -z "${DB_NAME}" ]] && DB_NAME="gestion_pedidos_dev"

MYSQL_CMD=(mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}")
[[ -n "${DB_PASS}" ]] && MYSQL_CMD+=(-p"${DB_PASS}")

# -------------------------
# 1) Traer últimos cambios
# -------------------------
info "Actualizando repositorio en ${REPO_DIR}..."
cd "${REPO_DIR}"
git fetch --all
git reset --hard origin/main
ok "Repositorio sincronizado con origin/main"

# -------------------------
# 2) Backend deps + schema
# -------------------------
info "Instalando dependencias de backend..."
cd "${BACKEND_DIR}"
if npm ci --omit=dev; then
  ok "npm ci completado"
else
  warn "npm ci falló, intentando npm install"
  npm install
fi

info "Ejecutando scripts portables de esquema (si existen)..."
[[ -f scripts/ensure_schema_portable.js ]] && node scripts/ensure_schema_portable.js || true
[[ -f scripts/ensure_analytics_schema_portable.js ]] && node scripts/ensure_analytics_schema_portable.js || true
[[ -f scripts/fix_enums_portable.js ]] && node scripts/fix_enums_portable.js || true
ok "Esquema verificado/aplicado (si fue necesario)"

# -------------------------
# 3) Reinicio backend PM2
# -------------------------
info "Reiniciando backend con PM2..."
pm2 restart gestion-backend --update-env >/dev/null 2>&1 || pm2 start server.js --name gestion-backend --time
sleep 2
pm2 save >/dev/null 2>&1 || true
ok "PM2 en ejecución"
pm2 ls

# -------------------------
# 4) Validar Nginx y recarga
# -------------------------
if command -v nginx >/dev/null 2>&1; then
  info "Validando configuración de Nginx..."
  if nginx -t; then
    systemctl reload nginx || true
    ok "Nginx OK y recargado"
  else
    warn "nginx -t reportó errores; revisa /etc/nginx/sites-available/gestion-pedidos.conf"
  fi
else
  warn "Nginx no está instalado; saltando verificación."
fi

# -------------------------
# 5) Health + Login + APIs
# -------------------------
BACK_HEALTH_CODE="$(http_status "http://127.0.0.1/api/health")"
[[ "${BACK_HEALTH_CODE}" == "200" ]] && ok "Health API (Nginx->backend): 200" || err "Health API devolvió ${BACK_HEALTH_CODE}"

TOKEN="$(get_token "${ADMIN_USER}" "${ADMIN_PASS}")"
if [[ -n "${TOKEN}" ]]; then
  ok "Token obtenido (${#TOKEN} chars)"
else
  err "No se pudo obtener token con ${ADMIN_USER}. Revisa credenciales."
fi

PROD_CODE="$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer ${TOKEN}" "http://127.0.0.1/api/products?page=1&pageSize=20&search=")"
READY_CODE="$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer ${TOKEN}" "http://127.0.0.1/api/logistics/ready-for-delivery")"

# -------------------------
# 6) SIIGO: estado/health
# -------------------------
SIIGO_API_CODE=""
SIIGO_ENABLED_DB="unknown"
if [[ -n "${TOKEN}" ]]; then
  # Intentar endpoint de estado SIIGO, si existe
  SIIGO_API_CODE="$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer ${TOKEN}" "http://127.0.0.1/api/siigo/status" || echo "")"
fi

# Fallback: leer is_enabled de la BD si existe la tabla siigo_credentials
if "${MYSQL_CMD[@]}" -e "USE ${DB_NAME}; SHOW TABLES LIKE 'siigo_credentials';" >/dev/null 2>&1; then
  if "${MYSQL_CMD[@]}" -N -e "USE ${DB_NAME}; SELECT is_enabled FROM siigo_credentials ORDER BY updated_at DESC, created_at DESC LIMIT 1;" >/tmp/siigo_enabled.txt 2>/dev/null; then
    val="$(cat /tmp/siigo_enabled.txt | tr -d ' \t\r\n')"
    case "$val" in
      1|true|TRUE) SIIGO_ENABLED_DB="enabled" ;;
      0|false|FALSE|"") SIIGO_ENABLED_DB="disabled" ;;
      *) SIIGO_ENABLED_DB="unknown(${val})" ;;
    esac
  fi
fi

# -------------------------
# 7) Puertos y servicios
# -------------------------
info "Relevando puertos y procesos..."
BACK_DIRECT_CODE="$(http_status "http://127.0.0.1:${BACKEND_PORT}/api/health")"
FRONT_CODE="$(http_status "http://127.0.0.1/")"

PORTS_OUT="$( (ss -tulpn 2>/dev/null || netstat -tulpn 2>/dev/null || true) | grep -E ":80|:${BACKEND_PORT}" || true )"

# -------------------------
# 8) Resumen Final
# -------------------------
echo
echo "===================== RESUMEN REINICIO GOLD ====================="
echo "Rama en uso:          $(cd "${REPO_DIR}" && git rev-parse --abbrev-ref HEAD)"
echo "Último commit:        $(cd "${REPO_DIR}" && git log -1 --oneline)"
echo "Backend port (.env):  ${BACKEND_PORT}"
echo "Health (Nginx):       ${BACK_HEALTH_CODE}"
echo "Health (directo):     ${BACK_DIRECT_CODE}"
echo "Login token:          $([[ -n "${TOKEN}" ]] && echo "OK (${#TOKEN} chars)" || echo "FAIL")"
echo "GET /api/products:    ${PROD_CODE}"
echo "GET /ready-delivery:  ${READY_CODE}"
echo "SIIGO /api status:    ${SIIGO_API_CODE:-N/A}"
echo "SIIGO DB is_enabled:  ${SIIGO_ENABLED_DB}"
echo "Frontend (/):         ${FRONT_CODE}"
echo
echo "--- PM2 ---"
pm2 ls || true
echo
echo "--- Puertos relevantes ---"
echo "${PORTS_OUT:-No se detectaron puertos :80 o :${BACKEND_PORT}}"
echo
echo "Archivos Nginx:"
if command -v nginx >/dev/null 2>&1; then
  ls -l /etc/nginx/sites-available/gestion-pedidos.conf 2>/dev/null || true
  ls -l /etc/nginx/sites-enabled/gestion-pedidos.conf 2>/dev/null || true
fi
echo
echo "Backend .env (parcial): PORT=${BACKEND_PORT} DB_HOST=${DB_HOST} DB_NAME=${DB_NAME}"
echo "================================================================="
echo

# Estado de salida: no cortar ejecución si algún check falla, pero indicar código !=0 si crítico
EXIT_CODE=0
[[ "${BACK_HEALTH_CODE}" != "200" ]] && EXIT_CODE=1
[[ -z "${TOKEN}" ]] && EXIT_CODE=1
[[ "${PROD_CODE}" != "200" ]] && EXIT_CODE=1
exit "${EXIT_CODE}"
