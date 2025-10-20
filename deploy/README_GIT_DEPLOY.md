# Despliegue usando Git (HTTP sin SSL, MySQL local, PM2 + Nginx)

Este flujo asume:
- VPS Ubuntu “en blanco” (22.04/20.04)
- Sin dominio, solo IP pública
- Sin SSL (HTTP)
- MySQL en el mismo VPS
- Usaremos Git para clonar el repo en el servidor

El repositorio ya incluye:
- deploy/provision_http_vps.sh (provisiona Nginx, Node LTS, PM2, MySQL; configura todo y arranca)
- deploy/nginx/gestion_de_pedidos_http.conf (site Nginx HTTP)
- ecosystem.config.js (PM2)
- Plantillas .env (backend/.env.production.example y frontend/.env.production.example)

1) Preparar Git y clonar el repositorio en el VPS
# Conéctate por SSH al VPS
ssh -p <PUERTO_SSH> <USUARIO>@<IP>

# Instalar git si no está
sudo apt update && sudo apt install -y git

# Crear carpeta destino y clonar
sudo mkdir -p /var/www && cd /var/www
sudo git clone <URL_DEL_REPO> gestion_de_pedidos
sudo chown -R $USER:$USER gestion_de_pedidos
cd gestion_de_pedidos

# (Opcional) Cambiar de rama si no es 'main'
# git checkout <RAMA>

2) Variables (opcional) para credenciales de la app (MySQL local)
# Por defecto el script crea:
#  - DB: gestion_pedidos
#  - USER: gp_user
#  - PASS: gp_password_segura  (Cámbiala)
# Puedes personalizarlas exportando variables antes de ejecutar el script:
export APP_DB_NAME=gestion_pedidos
export APP_DB_USER=gp_user
export APP_DB_PASS='<PonUnaClaveFuerteAQUI>'

# Opcional: forzar IP pública detectada para URLs
# export SERVER_IP=<IP_PUBLICA>

# (opcional) firewall UFW (true por defecto)
# export CONFIGURE_UFW=true

3) Provisionar e iniciar (HTTP + MySQL local)
# Dar permisos y ejecutar como root (o con sudo)
chmod +x deploy/provision_http_vps.sh
sudo ./deploy/provision_http_vps.sh

Qué hace este script
- Instala: Nginx, Node.js LTS (20 por defecto), PM2 y MySQL Server
- Crea la BD y usuario MySQL local (APP_DB_NAME/USER/PASS)
- Copia el site HTTP: deploy/nginx/gestion_de_pedidos_http.conf -> /etc/nginx/sites-available/gestion_de_pedidos y habilita
- Genera backend/.env desde backend/.env.production.example (o .env.example de fallback) con:
  - DB_HOST=localhost, DB_PORT=3306, DB_USER/DB_PASSWORD/DB_NAME (según variables)
  - FRONTEND_URL=http://<IP>
  - JWT_SECRET y CONFIG_ENCRYPTION_KEY seguros
- Instala dependencias backend (npm ci), intenta correr database/migrate.js si existe
- Arranca backend con PM2 (puerto 3001)
- Genera frontend/.env.production con REACT_APP_API_URL=http://<IP>/api
- Instala deps de frontend y compila build
- Ajusta permisos en frontend/build para Nginx

4) Verificación rápida
# Frontend (React):
http://<IP>

# Salud/endpoint público:
http://<IP>/api/config/public

# PM2 procesos / logs backend:
pm2 ls
pm2 logs gestion-backend

# Nginx:
sudo nginx -t
sudo tail -f /var/log/nginx/gestion_de_pedidos.error.log

5) Actualizar la aplicación (pull con Git y reinicio sin SSL)
cd /var/www/gestion_de_pedidos
git fetch --all
git checkout <RAMA>         # si aplica
git pull

# Reinstalar dependencias si cambió package.json del backend
npm --prefix backend ci
pm2 restart gestion-backend
pm2 save

# Si cambiaste el frontend o .env.production, recompila:
npm --prefix frontend ci
npm --prefix frontend run build

6) Notas y recomendaciones
- CORS: FRONTEND_URL se fija a http://<IP> en backend/.env. Si usas otro origen, ajusta esa variable y reinicia PM2.
- Seguridad: al usar HTTP, las credenciales viajan sin cifrar. Se recomienda migrar a HTTPS cuando sea posible (hay plantilla Nginx HTTPS en deploy/nginx/gestion_de_pedidos.conf para certbot).
- MySQL: el usuario se crea con host 'localhost'. Si algún día mueves MySQL a otro host, ajusta backend/.env y reinicia.
- Firewall: si usas UFW, verifica que esté permitido OpenSSH y HTTP (80).

7) Troubleshooting
- Nginx site no sirve el build:
  - Revisa root en /etc/nginx/sites-available/gestion_de_pedidos (debe ser /var/www/gestion_de_pedidos/frontend/build)
  - Permisos del build: sudo chown -R www-data:www-data /var/www/gestion_de_pedidos/frontend/build
  - nginx -t && sudo systemctl reload nginx
- Backend no arranca:
  - pm2 logs gestion-backend
  - Revisa credenciales en backend/.env
  - Verifica MySQL: sudo systemctl status mysql
- API devuelve CORS:
  - Ajusta FRONTEND_URL en backend/.env y reinicia PM2

Con esto queda instalado por Git y provisionado automáticamente con el script incluido.
