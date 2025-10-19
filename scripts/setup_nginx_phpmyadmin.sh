#!/usr/bin/env bash
# Configura Nginx + phpMyAdmin para gestion de pedidos en Ubuntu/Debian
# - Instala (si falta) nginx, php-fpm, php-mysql y phpmyadmin
# - Detecta automáticamente el socket de PHP-FPM
# - Crea el sitio gestion-pedidos.conf con frontend SPA, API proxy y phpMyAdmin
# - Habilita el sitio, prueba Nginx y recarga
# Uso:
#   sudo bash setup_nginx_phpmyadmin.sh

set -euo pipefail

echo "==> Comprobando privilegios (root requerido)..."
if [[ "${EUID}" -ne 0 ]]; then
  echo "ERROR: ejecuta como root: sudo bash $0"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "==> Actualizando índices APT..."
apt-get update -y

echo "==> Instalando paquetes necesarios (nginx, php-fpm, php-mysql, phpmyadmin)..."
apt-get install -y nginx php-fpm php-mysql phpmyadmin curl ca-certificates

if [[ ! -d /usr/share/phpmyadmin ]]; then
  echo "ERROR: No se encontró /usr/share/phpmyadmin después de instalar el paquete."
  echo "Verifica que el paquete phpmyadmin se haya instalado correctamente."
  exit 1
fi

echo "==> Detectando socket de PHP-FPM..."
SOCK=""
# 1) Buscar sockets existentes
SOCK=$(find /run/php -maxdepth 1 -type s -name "php*-fpm.sock" | sort | head -n1 || true)

# 2) Intentar por versiones comunes si no se encontró
if [[ -z "${SOCK}" ]]; then
  for v in 8.3 8.2 8.1 8.0 7.4; do
    if [[ -S "/run/php/php${v}-fpm.sock" ]]; then
      SOCK="/run/php/php${v}-fpm.sock"
      break
    fi
  done
fi

# 3) Intentar arrancar php-fpm si aún no hay socket
if [[ -z "${SOCK}" ]]; then
  echo "   No se detectó socket activo. Intentando iniciar php-fpm..."
  systemctl restart php*-fpm || true
  sleep 2
  SOCK=$(find /run/php -maxdepth 1 -type s -name "php*-fpm.sock" | sort | head -n1 || true)
fi

if [[ -z "${SOCK}" ]]; then
  echo "ERROR: No fue posible detectar el socket de PHP-FPM en /run/php/*.sock"
  echo "Asegúrate de que php-fpm esté instalado y en ejecución: systemctl status php*-fpm"
  exit 1
fi

echo "   Socket PHP-FPM detectado: ${SOCK}"

FRONTEND_ROOT=/var/www/gestion-frontend
SITE_AVAIL=/etc/nginx/sites-available/gestion-pedidos.conf
SITE_ENABLED=/etc/nginx/sites-enabled/gestion-pedidos.conf

echo "==> Creando carpeta de frontend si no existe: ${FRONTEND_ROOT}"
mkdir -p "${FRONTEND_ROOT}"

echo "==> Escribiendo configuración de Nginx en ${SITE_AVAIL} ..."
cat > "${SITE_AVAIL}" <<NGINX
upstream pedidos_backend {
    server 127.0.0.1:3001;
    keepalive 64;
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # Frontend estático (SPA)
    root ${FRONTEND_ROOT};
    index index.html;

    location / {
        try_files \$uri /index.html;
    }

    # API hacia backend Node
    location /api/ {
        proxy_pass http://pedidos_backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection "";
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

    # Estáticos con cache
    location ~* \.(?:js|css|woff2?|ttf|eot|ico|svg|gif|jpg|jpeg|png)$ {
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
        try_files \$uri /index.html;
    }

    # ---------- phpMyAdmin ----------
    # Redirige /phpmyadmin sin slash a /phpmyadmin/ (evita 404 con alias)
    location = /phpmyadmin {
        return 302 /phpmyadmin/;
    }

    # Sirve phpMyAdmin usando root (más robusto con PHP-FPM)
    location /phpmyadmin/ {
        root /usr/share/;
        index phpmyadmin/index.php index.php;
        try_files \$uri \$uri/ /phpmyadmin/index.php;
    }

    # Ejecutar PHP bajo /phpmyadmin (usa root y $document_root)
    location ~ ^/phpmyadmin/.+\.php$ {
        root /usr/share/;
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:${SOCK};
        # fastcgi-php.conf define: fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }

    # Archivos estáticos de phpMyAdmin
    location ~* ^/phpmyadmin/(.+\.(?:css|js|jpg|jpeg|png|gif|ico|svg))$ {
        root /usr/share/;
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
    }
}
NGINX

echo "==> Habilitando sitio gestion-pedidos ..."
ln -sf "${SITE_AVAIL}" "${SITE_ENABLED}"
rm -f /etc/nginx/sites-enabled/default || true

echo "==> Probando configuración de Nginx ..."
nginx -t

echo "==> Recargando Nginx ..."
systemctl reload nginx

# Asegurar servicios activos
systemctl enable nginx >/dev/null 2>&1 || true
systemctl enable "php*-fpm" >/dev/null 2>&1 || true
systemctl restart nginx

echo "==> Verificaciones rápidas:"
echo "    - Carpeta phpMyAdmin: " $(ls -ld /usr/share/phpmyadmin | awk '{print $9, $1, $3, $4}' || true)
echo "    - Respuesta cabecera /phpmyadmin/:"
curl -sS -I http://127.0.0.1/phpmyadmin/ | head -n 1 || true

echo
echo "==> Todo listo."
echo "Abre en tu navegador:  http://TU_IP/            (frontend)"
echo "                       http://TU_IP/phpmyadmin   (phpMyAdmin)"
echo
echo "Si ves 404 en /phpmyadmin:"
echo "  - Verifica que /usr/share/phpmyadmin exista (ya verificado arriba)."
echo "  - Asegúrate de entrar con slash final: /phpmyadmin/ (esta config redirige desde /phpmyadmin)."
echo "  - Repite este script para reescribir la config y recargar Nginx."
