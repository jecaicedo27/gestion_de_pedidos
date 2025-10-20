# Configurar VPS desde cero (Ubuntu 24.04 LTS) con Git + PM2 + Nginx + MySQL (HTTP sin SSL)

Este instructivo usa:
- Git para clonar el repositorio
- Nginx para servir el frontend (React build) y hacer reverse proxy al backend en /api
- PM2 para ejecutar el backend Node.js
- MySQL local
- Sin dominio ni SSL (acceso por IP)

Pre-requisitos
- Estás conectado por SSH al VPS (Ubuntu 24.04 LTS)
- Tienes la URL del repositorio Git

1) Instalar git y dependencias mínimas
sudo apt update && sudo apt install -y git

2) Clonar el repositorio en /var/www (ajusta la URL y rama)
# 2.1 Crear carpeta y clonar
sudo mkdir -p /var/www && cd /var/www
sudo git clone <REPO_URL> gestion_de_pedidos
sudo chown -R $USER:$USER gestion_de_pedidos
cd gestion_de_pedidos

# 2.2 (Opcional) Cambiar a otra rama si no es 'main'
# git checkout <RAMA>

3) (Opcional) Configurar variables para la BD de la app (MySQL local) y IP
# Cambia la contraseña por una fuerte antes de ejecutar el script
export APP_DB_NAME=gestion_pedidos
export APP_DB_USER=gp_user
export APP_DB_PASS='PonUnaClaveFuerteAQUI'

# Normalmente se autodetecta la IP pública; puedes forzarla si quieres:
export SERVER_IP=$(hostname -I | awk '{print $1}')
# export SERVER_IP=<IP_PUBLICA>

4) Aprovisionar todo automáticamente (HTTP + MySQL local + Node LTS + PM2 + Nginx)
# Dar permisos al script e iniciar (requiere sudo/root)
chmod +x deploy/provision_http_vps.sh
sudo ./deploy/provision_http_vps.sh

Qué realiza el script (deploy/provision_http_vps.sh)
- Instala: Nginx, Node.js LTS (v20), PM2 y MySQL Server
- Crea BD y usuario MySQL local (APP_DB_NAME/USER/PASS)
- Instala el sitio Nginx HTTP: deploy/nginx/gestion_de_pedidos_http.conf -> /etc/nginx/sites-available/gestion_de_pedidos y lo habilita
- Genera backend/.env (desde backend/.env.production.example o .env.example):
  - DB_HOST=localhost, DB_PORT=3306, DB_USER/DB_PASSWORD/DB_NAME
  - FRONTEND_URL=http://<IP>
  - JWT_SECRET y CONFIG_ENCRYPTION_KEY seguros (se generan automáticamente)
- Instala dependencias backend (npm ci) e intenta correr database/migrate.js
- Arranca backend con PM2 (puerto 3001, nombre: gestion-backend)
- Genera frontend/.env.production con REACT_APP_API_URL=http://<IP>/api, instala deps y compila el build
- Ajusta permisos del build para Nginx

5) Verificación rápida
# Descubrir IP (si no la conoces)
hostname -I

# Probar frontend (desde tu navegador):
http://<IP>

# Probar endpoint público de API:
curl -I http://<IP>/api/config/public
# o
curl http://<IP>/api/config/public

# Revisar procesos PM2 y logs del backend:
pm2 ls
pm2 logs gestion-backend

# Verificar Nginx:
sudo nginx -t
sudo tail -f /var/log/nginx/gestion_de_pedidos.error.log

# Verificar MySQL:
sudo systemctl status mysql --no-pager

6) Actualizar la app en el futuro (pull con Git y reinicio)
cd /var/www/gestion_de_pedidos
git fetch --all
git pull
# Backend (si cambió package.json)
npm --prefix backend ci
pm2 restart gestion-backend
pm2 save
# Frontend (si cambió código o .env.production)
npm --prefix frontend ci
npm --prefix frontend run build

7) Notas y troubleshooting
- CORS: la variable FRONTEND_URL del backend se establece a http://<IP>. Si sirves el frontend desde otro origen, ajusta FRONTEND_URL en backend/.env y reinicia PM2.
- Seguridad: al ser HTTP, las credenciales viajan sin cifrar. Considera migrar a HTTPS más adelante (ya existe plantilla deploy/nginx/gestion_de_pedidos.conf preparada para certbot).
- Si Nginx no sirve estáticos:
  - Revisa la directiva root del site en /etc/nginx/sites-available/gestion_de_pedidos (debe apuntar a /var/www/gestion_de_pedidos/frontend/build)
  - Ajusta permisos del build: sudo chown -R www-data:www-data /var/www/gestion_de_pedidos/frontend/build
  - sudo nginx -t && sudo systemctl reload nginx
- Si el backend no levanta:
  - pm2 logs gestion-backend
  - Revisa credenciales en backend/.env
  - Verifica MySQL: sudo systemctl status mysql
