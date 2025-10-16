#!/usr/bin/env bash
# ==============================================================================
# Fix backend DB connection (force IPv4 127.0.0.1), install missing deps,
# restart PM2 backend on port 3001, install Leaflet, rebuild frontend,
# and reload Nginx.
#
# Usage (on server):
#   sudo -s
#   cd /var/www/gestion_de_pedidos
#   bash deploy/scripts/fix_backend_env_and_rebuild.sh
#
# Safe to re-run multiple times.
# ==============================================================================

set -Eeuo pipefail

# --- helpers ------------------------------------------------------------------
log()   { printf "\033[1;34m[INFO]\033[0m %s\n" "$*"; }
warn()  { printf "\033[1;33m[WARN]\033[0m %s\n" "$*"; }
err()   { printf "\033[1;31m[ERR ]\033[0m %s\n" "$*" >&2; }
ok()    { printf "\033[1;32m[ OK ]\033[0m %s\n" "$*"; }

# Root of repo based on this script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

log "Repo root: $REPO_ROOT"

# Print versions (best-effort)
{ node -v && npm -v && pm2 -v; } >/dev/null 2>&1 || true
log "Node: $(node -v 2>/dev/null || echo n/a) | npm: $(npm -v 2>/dev/null || echo n/a) | pm2: $(pm2 -v 2>/dev/null || echo n/a)"

# --- step 1: fix backend .env -------------------------------------------------
BACKEND_ENV="$REPO_ROOT/backend/.env"
if [[ ! -f "$BACKEND_ENV" ]]; then
  warn "backend/.env no existe; copiando desde backend/.env.example"
  if [[ -f "$REPO_ROOT/backend/.env.example" ]]; then
    cp "$REPO_ROOT/backend/.env.example" "$BACKEND_ENV"
  else
    err "No existe backend/.env ni backend/.env.example. Abortando."
    exit 1
  fi
fi

log "Antes (valores DB_...):"
grep -E '^(DB_HOST|DB_USER|DB_PASSWORD|DB_NAME)=' "$BACKEND_ENV" || true

set_kv() {
  local key="$1" val="$2" file="$3"
  if grep -qE "^${key}=" "$file"; then
    sed -i -E "s|^${key}=.*|${key}=${val}|" "$file"
  else
    echo "${key}=${val}" >> "$file"
  fi
}

# Force IPv4 + known credentials created by installer
set_kv "DB_HOST"     "127.0.0.1"          "$BACKEND_ENV"
set_kv "DB_USER"     "gp_user"            "$BACKEND_ENV"
set_kv "DB_PASSWORD" "gp_password"        "$BACKEND_ENV"
set_kv "DB_NAME"     "gestion_pedidos_dev" "$BACKEND_ENV"

log "Después (valores DB_...):"
grep -E '^(DB_HOST|DB_USER|DB_PASSWORD|DB_NAME)=' "$BACKEND_ENV" || true

# --- step 2: ensure MySQL is up and DB/user work ------------------------------
log "Asegurando MySQL activo..."
if systemctl list-unit-files | grep -q '^mysql\.service'; then
  systemctl start mysql || true
  systemctl status mysql --no-pager | sed -n '1,10p' || true
else
  service mysql start || true
  service mysql status || true
fi

log "Verificando DB con cuenta de mantenimiento (debian.cnf)..."
if mysql --defaults-file=/etc/mysql/debian.cnf -e "SHOW DATABASES LIKE 'gestion_pedidos_dev';" >/dev/null 2>&1; then
  ok "Base de datos gestion_pedidos_dev existe"
else
  warn "DB gestion_pedidos_dev no encontrada; intentamos crearla rápidamente"
  tee /tmp/gp_init.sql >/dev/null <<'SQL'
CREATE DATABASE IF NOT EXISTS `gestion_pedidos_dev` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'gp_user'@'%' IDENTIFIED BY 'gp_password';
CREATE USER IF NOT EXISTS 'gp_user'@'localhost' IDENTIFIED BY 'gp_password';
GRANT ALL PRIVILEGES ON `gestion_pedidos_dev`.* TO 'gp_user'@'%';
GRANT ALL PRIVILEGES ON `gestion_pedidos_dev`.* TO 'gp_user'@'localhost';
FLUSH PRIVILEGES;
SQL
  mysql --defaults-file=/etc/mysql/debian.cnf < /tmp/gp_init.sql || true
fi

log "Probar conexión como gp_user@127.0.0.1..."
if mysql -h 127.0.0.1 -ugp_user -pgp_password -e "USE gestion_pedidos_dev; SELECT 1;" >/dev/null 2>&1; then
  ok "Conexión MySQL OK con gp_user"
else
  warn "No se pudo conectar como gp_user - revisa firewall/usuarios MySQL"
fi

# --- step 3: backend deps + restart pm2 --------------------------------------
log "Instalando dependencias del backend..."
pushd "$REPO_ROOT/backend" >/dev/null
npm ci || npm install
# Asegurar express-validator presente
if ! npm ls express-validator >/dev/null 2>&1; then
  npm install express-validator
fi
popd >/dev/null

log "Reiniciando PM2 backend..."
if pm2 list | grep -q 'gestion-backend'; then
  pm2 restart gestion-backend
else
  pm2 start "$REPO_ROOT/backend/server.js" --name gestion-backend
fi

sleep 2
log "Esperando que el puerto 3001 esté arriba..."
attempts=30
until curl -sS -I http://127.0.0.1:3001/api/config/public >/dev/null 2>&1; do
  attempts=$((attempts-1))
  if [[ $attempts -le 0 ]]; then
    warn "API aún no responde en 127.0.0.1:3001. Continuamos, pero revisa logs."
    break
  fi
  sleep 1
done
if curl -sS -I http://127.0.0.1:3001/api/config/public >/dev/null 2>&1; then
  ok "Backend responde en 127.0.0.1:3001"
else
  warn "Backend no respondió todavía. Últimas líneas de logs:"
  pm2 logs gestion-backend --lines 50 || true
fi

# --- step 4: frontend leaflet + build ----------------------------------------
log "Instalando Leaflet y construyendo frontend..."
pushd "$REPO_ROOT/frontend" >/dev/null
# Instalar leaflet (arregla 'Can't resolve leaflet/dist/leaflet.css' y 'leaflet')
npm install leaflet
npm run build
popd >/dev/null

# --- step 5: reload nginx -----------------------------------------------------
if command -v nginx >/dev/null 2>&1; then
  log "Verificando configuración Nginx..."
  if nginx -t; then
    log "Recargando Nginx..."
    systemctl reload nginx || service nginx reload || true
    ok "Nginx recargado"
  else
    warn "nginx -t falló. Revisa las conf en deploy/nginx/*.conf"
  fi
else
  warn "Nginx no encontrado en PATH. Saltando recarga."
fi

# --- summary ------------------------------------------------------------------
echo "=============================================================================="
ok "Proceso completado."
echo "- Verifica en navegador: http://$(hostname -I | awk '{print $1}')/login (Ctrl+F5)"
echo "- Asegúrate de que las llamadas de frontend vayan a /api/... (no a localhost:3001)"
echo "- Endpoint local backend: curl -I http://127.0.0.1:3001/api/config/public"
echo "- Logs backend: pm2 logs gestion-backend --lines 120"
echo "Si necesitas forzar usuario admin/admin123, ejecuta:"
echo "  node -e \"(async()=>{const p=require('path');const d=require('./backend/node_modules/dotenv');d.config({path:p.resolve('backend/.env')});const mysql=require('./backend/node_modules/mysql2/promise');const bcrypt=require('./backend/node_modules/bcryptjs');const c=await mysql.createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});const u='admin', pass='admin123', h=await bcrypt.hash(pass,10);let r=await c.execute('UPDATE users SET password=?, role=\"admin\", active=1 WHERE username=?',[h,u]);if(!r[0].affectedRows){await c.execute('INSERT INTO users (username,email,phone,password,role,active,full_name) VALUES (?,?,?,?,?,?,?)',[u,'admin@empresa.com','3000000000',h,'admin',1,'Administrador']);}let [rows]=await c.execute('SELECT id,username,role,active FROM users WHERE username=?',[u]);console.log(rows);await c.end();})();\""
echo "=============================================================================="

exit 0
