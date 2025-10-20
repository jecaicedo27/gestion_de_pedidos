#!/usr/bin/env bash
# Fresh minimal install of "Gestion de Pedidos" from Git on a clean Ubuntu server (Nginx + MySQL + PHPMyAdmin + Node + PM2)
# WARNING: Minimal security (HTTP only, phpMyAdmin sin protección). Para producción, agrega HTTPS y BasicAuth luego.
#
# Usage:
#   sudo bash deploy/scripts/fresh_install_minimal.sh <SERVER_IP_OR_DOMAIN> [DB_NAME] [DB_USER] [DB_PASS]
# Example:
#   sudo bash deploy/scripts/fresh_install_minimal.sh 46.202.93.54 gestion_pedidos_dev gp_user gp_password
#
# What it does:
#  - Installs: git, curl, build tools, nginx, mysql-server, php-fpm, php-mysql, phpmyadmin
#  - Installs Node.js 18 LTS and PM2
#  - Creates MySQL database + user (DB_NAME/DB_USER/DB_PASS)
#  - Clones the repo into /var/www/gestion_de_pedidos
#  - Generates backend .env with DB creds + secure secrets
#  - Installs backend and frontend deps; builds frontend
#  - Writes a minimal Nginx site (HTTP) serving React build + proxy to backend + phpMyAdmin without auth
#  - Starts backend with PM2
#  - Bootstraps DB (siigo_credentials table + admin/admin123 user)
#
# Re-run safe: idempotente en la mayoría de pasos.

set -euo pipefail

# -------- Helpers --------
log()   { echo -e "\033[1;34m[INFO]\033[0m $*"; }
warn()  { echo -e "\033[1;33m[WARN]\033[0m $*"; }
error() { echo -e "\033[1;31m[ERROR]\033[0m $*" 1>&2; }
die()   { error "$*"; exit 1; }

require_root() {
  if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
    die "Ejecuta como root: sudo bash $0 <SERVER_IP_OR_DOMAIN> [DB_NAME] [DB_USER] [DB_PASS]"
  fi
}

# -------- Inputs / Defaults --------
SERVER_NAME="${1:-}"
DB_NAME="${2:-gestion_pedidos_dev}"
DB_USER="${3:-gp_user}"
DB_PASS="${4:-gp_password}"

APP_DIR="/var/www/gestion_de_pedidos"
REPO_URL="https://github.com/jecaicedo27/gestion_de_pedidos.git"

[[ -n "$SERVER_NAME" ]] || die "Falta SERVER_IP_OR_DOMAIN. Uso: sudo bash $0 <SERVER_IP_OR_DOMAIN> [DB_NAME] [DB_USER] [DB_PASS]"

# -------- Detect PHP-FPM socket --------
detect_phpfpm_socket() {
  local sockets
  sockets=$(ls /run/php/php*-fpm.sock 2>/dev/null || true)
  if [[ -n "$sockets" ]]; then
    PHPFPM_SOCK=$(echo "$sockets" | sort -Vr | head -n1)
  else
    # fallback a versiones comunes
    for v in 8.3 8.2 8.1 8.0 7.4; do
      if [[ -S "/run/php/php${v}-fpm.sock" ]]; then
        PHPFPM_SOCK="/run/php/php${v}-fpm.sock"
        break
      fi
    done
  fi
  [[ -n "${PHPFPM_SOCK:-}" ]] || die "No se detectó socket de PHP-FPM en /run/php. ¿php-fpm está instalado/arriba?"
  log "PHP-FPM socket: ${PHPFPM_SOCK}"
}

# -------- Install base packages --------
install_packages() {
  log "Actualizando e instalando paquetes base..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y git curl ca-certificates gnupg lsb-release build-essential
  apt-get install -y nginx mysql-server php-fpm php-mysql phpmyadmin
  systemctl enable --now nginx
  systemctl enable --now mysql
  systemctl enable --now php*-fpm || true
}

# -------- Install Node 18 LTS + PM2 --------
install_node_pm2() {
  if ! command -v node >/dev/null 2>&1; then
    log "Instalando Node.js 18 LTS..."
    # Nodesource setup
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
  else
    log "Node ya instalado: $(node -v)"
  fi
  if ! command -v pm2 >/dev/null 2>&1; then
    log "Instalando PM2 global..."
    npm install -g pm2
  fi
}

# -------- MySQL: create DB + user --------
mysql_exec() {
  # Intenta con root socket; si root requiere password, permite MYSQL_PWD en env
  mysql -uroot -h 127.0.0.1 -e "$1" || mysql -uroot -e "$1"
}

create_db_and_user() {
  log "Creando base de datos y usuario..."
  mysql_exec "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  mysql_exec "CREATE USER IF NOT EXISTS '${DB_USER}'@'%' IDENTIFIED BY '${DB_PASS}';"
  mysql_exec "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
  mysql_exec "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'%';"
  mysql_exec "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';"
  mysql_exec "FLUSH PRIVILEGES;"
}

# -------- Clone repo --------
clone_repo() {
  log "Clonando repositorio en ${APP_DIR} ..."
  mkdir -p "$(dirname "$APP_DIR")"
  if [[ -d "$APP_DIR/.git" ]]; then
    log "Repo ya existe, haciendo pull..."
    (cd "$APP_DIR" && git pull --rebase)
  else
    git clone "$REPO_URL" "$APP_DIR"
  fi
  chown -R "${SUDO_USER:-root}:${SUDO_USER:-root}" "$APP_DIR" || true
}

# -------- Secrets --------
rand_hex() { openssl rand -hex 32; }

# -------- Setup backend .env --------
setup_backend_env() {
  log "Configurando backend/.env ..."
  local env="${APP_DIR}/backend/.env"
  local example="${APP_DIR}/backend/.env.example"

  if [[ -f "$env" ]]; then
    warn "backend/.env ya existe, se conservará. Actualiza manualmente si es necesario."
    return
  fi

  if [[ -f "$example" ]]; then
    cp "$example" "$env"
  else
    touch "$env"
  fi

  # Asegurar claves principales
  sed -i "s/^DB_HOST=.*/DB_HOST=localhost/g" "$env" || true
  sed -i "s/^DB_USER=.*/DB_USER=${DB_USER}/g" "$env" || true
  sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=${DB_PASS}/g" "$env" || true
  sed -i "s/^DB_NAME=.*/DB_NAME=${DB_NAME}/g" "$env" || true

  # PORT backend por defecto
  if grep -q '^PORT=' "$env"; then
    sed -i "s/^PORT=.*/PORT=3001/g" "$env"
  else
    echo "PORT=3001" >> "$env"
  fi

  # JWT_SECRET
  if grep -q '^JWT_SECRET=' "$env"; then
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(rand_hex)|g" "$env"
  else
    echo "JWT_SECRET=$(rand_hex)" >> "$env"
  fi

  # CONFIG_ENCRYPTION_KEY (64 hex chars)
  if grep -q '^CONFIG_ENCRYPTION_KEY=' "$env"; then
    sed -i "s|^CONFIG_ENCRYPTION_KEY=.*|CONFIG_ENCRYPTION_KEY=$(rand_hex)|g" "$env"
  else
    echo "CONFIG_ENCRYPTION_KEY=$(rand_hex)" >> "$env"
  fi

  # Otros valores comunes
  if ! grep -q '^NODE_ENV=' "$env"; then echo "NODE_ENV=production" >> "$env"; fi
}

# -------- Install deps + build --------
install_and_build() {
  log "Instalando dependencias backend..."
  (cd "${APP_DIR}/backend" && npm install)

  if [[ -d "${APP_DIR}/frontend" ]]; then
    log "Instalando dependencias frontend y construyendo build..."
    (cd "${APP_DIR}/frontend" && npm install && npm run build)
  else
    warn "No se encontró carpeta frontend; se servirá solo backend/API."
  fi
}

# -------- Minimal Nginx site (HTTP) with phpMyAdmin (no auth) --------
write_nginx_conf() {
  detect_phpfpm_socket

  log "Escribiendo sitio Nginx minimal en /etc/nginx/sites-available/gestion_de_pedidos ..."
  cat >/etc/nginx/sites-available/gestion_de_pedidos <<NGX
server {
  listen 80;
  listen [::]:80;
  server_name ${SERVER_NAME};

  # Frontend (React build)
  root ${APP_DIR}/frontend/build;
  index index.html;

  # Static assets cache
  location ~* \.(?:js|css|svg|eot|otf|ttf|woff|woff2|jpg|jpeg|gif|png|ico)$ {
    try_files \$uri =404;
    access_log off;
    expires 30d;
    add_header Cache-Control "public, max-age=2592000, immutable";
  }

  # React SPA fallback
  location / {
    try_files \$uri /index.html;
  }

  # Backend API reverse proxy
  location /api/ {
    proxy_pass http://127.0.0.1:3001/api/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 300;
    proxy_connect_timeout 60;
    proxy_send_timeout 60;
  }

  # phpMyAdmin sin autenticación adicional (NO seguro para producción)
  location /phpmyadmin {
    alias /usr/share/phpmyadmin/;
    index index.php;
  }

  location ~ ^/phpmyadmin/(.+\.php)$ {
    alias /usr/share/phpmyadmin/\$1;
    include snippets/fastcgi-php.conf;
    fastcgi_pass unix:${PHPFPM_SOCK};
  }

  location ~* ^/phpmyadmin/(.+\.(css|js|png|jpg|jpeg|gif|ico|svg|ttf|woff|woff2))$ {
    alias /usr/share/phpmyadmin/\$1;
    access_log off;
    expires 30d;
  }

  access_log /var/log/nginx/gestion_de_pedidos.access.log;
  error_log  /var/log/nginx/gestion_de_pedidos.error.log;
}
NGX

  ln -sf /etc/nginx/sites-available/gestion_de_pedidos /etc/nginx/sites-enabled/gestion_de_pedidos
  nginx -t
  systemctl reload nginx
}

# -------- Start backend with PM2 --------
start_backend_pm2() {
  log "Iniciando backend con PM2..."
  # Matar instancia previa si existe
  pm2 delete gestion-backend &>/dev/null || true
  (cd "${APP_DIR}" && pm2 start backend/server.js --name gestion-backend --update-env)
  pm2 save || true

  # Habilitar arranque al boot
  if command -v pm2 >/dev/null 2>&1; then
    local target_user="${SUDO_USER:-root}"
    pm2 startup systemd -u "$target_user" --hp "/home/${target_user}" &>/dev/null || true
    log "PM2 configurado. Para completar startup puede requerir ejecutar el comando que muestra pm2."
  fi
}

# -------- Bootstrap DB (siigo_credentials + admin) --------
bootstrap_db() {
  if [[ -f "${APP_DIR}/deploy/scripts/bootstrap_db_siigo_admin.sh" ]]; then
    log "Ejecutando bootstrap de BD (siigo_credentials + admin)..."
    (cd "${APP_DIR}" && bash deploy/scripts/bootstrap_db_siigo_admin.sh "${DB_NAME}") || warn "Bootstrap DB devolvió warnings."
  else
    warn "No se encontró deploy/scripts/bootstrap_db_siigo_admin.sh; omitiendo bootstrap."
  fi
}

# -------- Main --------
require_root
install_packages
install_node_pm2
create_db_and_user
clone_repo
setup_backend_env
install_and_build
write_nginx_conf
start_backend_pm2
bootstrap_db

cat <<EOF

==========================================================
Instalación mínima completada.

URLs:
- App (login):     http://${SERVER_NAME}/login
- phpMyAdmin:      http://${SERVER_NAME}/phpmyadmin   (SIN protección extra; solo para pruebas)

Backend:
- PM2 process:     gestion-backend
- Ver logs:        pm2 logs gestion-backend --lines 80

Base de datos:
- DB Name:         ${DB_NAME}
- DB User:         ${DB_USER}
- DB Pass:         ${DB_PASS}
- Usuario app:     admin / admin123 (creado si no existía)

Siguientes pasos sugeridos:
1) Ingresar a la app y configurar credenciales SIIGO en Admin > Integraciones.
2) Cuando todo funcione, agregar seguridad:
   - HTTPS (Let's Encrypt), BasicAuth a /phpmyadmin, firewall (ufw), etc.
==========================================================
EOF
