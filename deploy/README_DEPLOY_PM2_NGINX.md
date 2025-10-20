# Despliegue en VPS con PM2 + Nginx (Backend Node + Frontend React)

Este documento describe un procedimiento reproducible para desplegar la app en un VPS (Ubuntu recomendado) usando:
- PM2 para ejecutar el backend Node.js
- Nginx para servir el frontend (build de React) y hacer reverse proxy del backend en /api
- Certbot (Let's Encrypt) para SSL

Estructura esperada en el VPS:
/var/www/gestion_de_pedidos
├─ backend              (código backend + .env)
├─ frontend             (código frontend + .env.production + build/)
├─ deploy/nginx         (plantilla Nginx)
├─ ecosystem.config.js  (archivo PM2)
└─ logs                 (logs de PM2)

Requisitos previos
- Dominio/subdominio apuntando (DNS A) al VPS (ej.: app.tu-dominio.com)
- Puertos 80 y 443 abiertos
- MySQL disponible (en el mismo VPS o un servicio externo administrado)
- Ubuntu 20.04/22.04 LTS recomendado

1) Acceso al VPS por SSH
ssh -p <PUERTO_SSH> <USUARIO>@<IP_O_DOMINIO>

2) Instalar dependencias base (Ubuntu)
sudo apt update && sudo apt upgrade -y
# Nginx + Certbot
sudo apt install -y nginx
sudo apt install -y certbot python3-certbot-nginx
# UFW (opcional)
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status

3) Instalar Node.js LTS y PM2
# Opción NodeSource (Node 20 LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar
node -v
npm -v

# Instalar PM2 global
sudo npm i -g pm2

# Habilitar arranque automático de PM2
pm2 startup systemd
# Siga la instrucción que imprime (ejecute el comando sudo env PATH=... pm2 startup ...)

4) Preparar directorio del proyecto
sudo mkdir -p /var/www/gestion_de_pedidos
sudo chown -R $USER:$USER /var/www/gestion_de_pedidos
cd /var/www/gestion_de_pedidos

# Opción A: Clonar desde Git (si existe repositorio remoto)
# git clone <URL_REPO> .

# Opción B: Subir con rsync/zip desde local
# rsync -avz --exclude node_modules --exclude .git ./gestion_de_pedidos/ <usuario>@<vps>:/var/www/gestion_de_pedidos/

mkdir -p logs

5) Configurar variables de entorno (backend)
# Copiar plantilla de producción y editar
cp backend/.env.production.example backend/.env

# Editar backend/.env con valores reales
# - DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
# - JWT_SECRET (seguro)
# - CONFIG_ENCRYPTION_KEY (64 chars hex; obligatorio en prod)
# - FRONTEND_URL=https://<TU_DOMINIO>
# - SIIGO_* (username, access key, partner id, base url, webhook secret)
# - WAPIFY_* (si aplica)

# Generar secrets de ejemplo (en local o en el VPS):
node -e "console.log('JWT_SECRET=', require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('CONFIG_ENCRYPTION_KEY=', require('crypto').randomBytes(32).toString('hex'))"

6) Instalar dependencias backend e iniciar con PM2
npm --prefix backend ci

# Iniciar con PM2 usando ecosystem.config.js (ya incluido en el repo)
pm2 start ecosystem.config.js --env production
pm2 save

# Ver logs del backend
pm2 logs gestion-backend

7) Configurar frontend (React) y compilar build de producción
# Copiar plantilla y editar
cp frontend/.env.production.example frontend/.env.production
# Ajustar:
# REACT_APP_API_URL=https://<TU_DOMINIO>/api

# Instalar deps y compilar
npm --prefix frontend ci
npm --prefix frontend run build

# Resultado en: /var/www/gestion_de_pedidos/frontend/build

8) Configurar Nginx (reverse proxy + estáticos)
# Copiar el site de plantilla (ya en el repo)
sudo cp deploy/nginx/gestion_de_pedidos.conf /etc/nginx/sites-available/gestion_de_pedidos

# Editar /etc/nginx/sites-available/gestion_de_pedidos:
# - Reemplazar YOUR_DOMAIN_OR_IP_HERE por tu dominio real
# - (Temporalmente) las rutas ssl_certificate seguirán con placeholder hasta emitir el cert

# Habilitar el site y probar
sudo ln -s /etc/nginx/sites-available/gestion_de_pedidos /etc/nginx/sites-enabled/gestion_de_pedidos
sudo nginx -t
sudo systemctl reload nginx

9) Emitir certificados SSL con Let's Encrypt
# Asegúrate de que el DNS ya apunta al VPS y puerto 80 abierto
sudo certbot --nginx -d <TU_DOMINIO>
# Responder preguntas y forzar redirección a HTTPS
# Certbot actualizará automáticamente la config SSL del site

# Verificar Nginx y recargar
sudo nginx -t
sudo systemctl reload nginx

10) Base de datos y migraciones
# Asegúrate de que backend/.env tiene la conexión correcta a MySQL
# Si MySQL está en el VPS y no existe la BD/usuario:
# sudo apt install -y mysql-server
# sudo mysql_secure_installation
# mysql -uroot -p
#   CREATE DATABASE gestion_pedidos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
#   CREATE USER 'prod_user'@'%' IDENTIFIED BY 'password_segura';
#   GRANT ALL PRIVILEGES ON gestion_pedidos.* TO 'prod_user'@'%';
#   FLUSH PRIVILEGES;

# Ejecutar migraciones (si aplica a tu flujo)
node database/migrate.js

# Si usas scripts específicos para tablas/cambios:
# node database/<script>.js

11) Verificaciones
# Backend corriendo en PM2
pm2 status
pm2 logs gestion-backend

# Nginx funcionando
curl -I http://localhost
curl -I https://<TU_DOMINIO>

# API disponible vía Nginx
curl -I https://<TU_DOMINIO>/api/config/public
# (o cualquier endpoint público disponible)

# Frontend cargando: abrir https://<TU_DOMINIO> en navegador

12) Cambios de entorno / despliegues futuros
# Backend: pull cambios, reinstalar deps si package.json cambia, reiniciar proceso
cd /var/www/gestion_de_pedidos
# git pull  (o rsync/zip)
npm --prefix backend ci
pm2 restart gestion-backend
pm2 save

# Frontend: si cambias REACT_APP_API_URL u otras env vars, recompila
npm --prefix frontend ci
npm --prefix frontend run build
# (No olvidar limpiar cachés del navegador en cambios críticos)

13) Logs y troubleshooting
# PM2
pm2 logs gestion-backend
pm2 restart gestion-backend
pm2 delete gestion-backend

# Nginx
sudo tail -f /var/log/nginx/gestion_de_pedidos.error.log
sudo tail -f /var/log/nginx/gestion_de_pedidos.access.log
sudo nginx -t

# Permisos de carpeta (si hay errores de lectura de estáticos)
sudo chown -R www-data:www-data /var/www/gestion_de_pedidos/frontend/build
sudo chown -R $USER:$USER /var/www/gestion_de_pedidos

14) Notas importantes de seguridad
- No versionar .env con claves reales
- Usar JWT_SECRET y CONFIG_ENCRYPTION_KEY robustos
- Limitar accesos MySQL por IPs de confianza o usar sockets internos
- Mantener el servidor actualizado (apt upgrade)
- Considerar Fail2ban y monitoreo (pm2 monit, Prometheus/Grafana, etc.)

15) Variables clave a revisar (resumen)
Backend (.env):
- NODE_ENV=production
- PORT=3001
- DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
- JWT_SECRET, JWT_EXPIRES_IN
- CONFIG_ENCRYPTION_KEY (64 chars hex)
- FRONTEND_URL=https://<TU_DOMINIO>
- SIIGO_ENABLED=true
- SIIGO_API_USERNAME, SIIGO_API_ACCESS_KEY, SIIGO_API_BASE_URL, SIIGO_API_PARTNER_ID
- SIIGO_WEBHOOK_SECRET
- WHATSAPP/WAPIFY tokens si aplica

Frontend (.env.production):
- REACT_APP_API_URL=https://<TU_DOMINIO>/api

16) Webhooks SIIGO (opcional)
- Si utilizas webhooks, asegúrate de exponer https://<TU_DOMINIO>/api/webhooks/receive
- Actualiza la base URL del webhook en backend/.env si aplica (WEBHOOK_BASE_URL)
- Verifica que Nginx reenvía correctamente a /api/

Checklist final
- [ ] DNS A del dominio apunta al VPS
- [ ] Nginx instalado y site habilitado con dominio correcto
- [ ] Certificado SSL emitido (certbot) y redirección HTTPS activa
- [ ] backend/.env y frontend/.env.production completados
- [ ] PM2 ejecutando el backend y persistente tras reboot (pm2 save + startup)
- [ ] Frontend build en /frontend/build y sirviéndose correctamente
- [ ] Migraciones de BD aplicadas sin errores
- [ ] Endpoints /api respondiendo OK a través de Nginx
