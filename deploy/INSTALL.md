# Instalación End‑to‑End (Producción y Desarrollo)

Este proyecto incluye un instalador automatizado para desplegar el sistema completo en un VPS Ubuntu, y also guías para ejecutar en desarrollo (localhost) de forma consistente. Está diseñado para funcionar con cualquier empresa o API de SIIGO mediante configuración por variables o desde el panel.

Contenido:
- Producción (Ubuntu): instalador automático end‑to‑end
- Variables de entorno soportadas (para instalación sin prompts)
- Post‑instalación y verificación
- Actualización de versión (redeploy)
- Desarrollo (localhost) en Windows/macOS/Linux
- Notas de arquitectura relevantes para despliegues en múltiples clientes

-------------------------------------------------------------------------------

## 1) Producción (Ubuntu) – Instalador Automático

Requisitos:
- Ubuntu 20.04+ o 22.04+ con acceso root (sudo)
- Repo clonado en /var/www/gestion_de_pedidos (o exporta GP_REPO_PATH)
- Puerto de backend deseado (default 3001)
- MariaDB/MySQL local (el instalador la instala si no existe)
- Nginx (el instalador lo instala/configura)

Comando (one‑liner) recomendado:
sudo GP_PUBLIC_HOST=46.202.93.54 \
GP_DB_NAME=gestion_pedidos_dev \
GP_DB_USER=gp_user \
GP_DB_PASS='cambia_esta_pass' \
GP_SIIGO_USERNAME='usuario@empresa.com' \
GP_SIIGO_ACCESS_KEY='clave_siigo' \
bash deploy/scripts/install_end_to_end.sh

Qué hace el instalador:
1) Instala/valida Node.js 20.x, PM2, Nginx, MariaDB
2) Crea la base de datos y usuario (si es posible automáticamente)
3) Genera backend/.env con los valores proporcionados
4) Instala dependencias del backend y ejecuta la migración portable de BD:
   - scripts/fix_enums_portable.js (idempotente)
5) Levanta el backend con PM2 (gestion‑backend), guarda configuración de arranque
6) Instala dependencias del frontend, construye el build y lo publica en /var/www/gestion-frontend
7) Crea el sitio Nginx con proxy a /api y socket.io, recarga Nginx
8) Health check del API vía Nginx y muestra endpoints finales

Endpoints esperados (HTTP):
- Frontend: http://46.202.93.54/
- API: http://46.202.93.54/api/health  → { success: true }

Notas:
- En producción el frontend usa por diseño same‑origin '/api' (no requiere configurar REACT_APP_API_URL).
- Puedes editar backend/.env y luego ejecutar: pm2 restart gestion-backend --update-env

-------------------------------------------------------------------------------

## 2) Variables soportadas (instalación sin prompts)

- GP_REPO_PATH=/var/www/gestion_de_pedidos
- GP_PUBLIC_HOST=dominio_o_ip (ej. 46.202.93.54)
- GP_BACKEND_PORT=3001
- GP_DB_NAME=gestion_pedidos_dev
- GP_DB_USER=gp_user
- GP_DB_PASS=gp_pass_123
- GP_DB_ROOT_PASS=...         (si root NO usa auth_socket)
- GP_SIIGO_USERNAME=...
- GP_SIIGO_ACCESS_KEY=...
- GP_SIIGO_BASE_URL=https://api.siigo.com
- GP_JWT_SECRET=...           (si se omite, se genera aleatorio)
- GP_FRONTEND_ROOT=/var/www/gestion-frontend

-------------------------------------------------------------------------------

## 3) Post‑instalación y verificación

- Ver logs backend:
  pm2 logs gestion-backend --lines 120 --nostream

- Verificar salud (desde el VPS):
  curl -i http://127.0.0.1/api/health

- Verificar desde navegador:
  http://46.202.93.54/
  http://46.202.93.54/api/health

- Si obtienes 502 en /api/health:
  - Confirma puerto real del backend:
    curl -i http://127.0.0.1:3001/api/health
  - Ajusta el puerto en /etc/nginx/sites-available/gestion-pedidos.conf
  - nginx -t && sudo systemctl reload nginx

- SIIGO:
  - Puedes configurar credenciales desde el panel si existe, o editar backend/.env y reiniciar PM2.

-------------------------------------------------------------------------------

## 4) Actualización de versión (redeploy)

En el VPS:
- Coloca el nuevo código (git pull, rsync, etc.) en /var/www/gestion_de_pedidos
- Backend:
  cd /var/www/gestion_de_pedidos/backend
  npm ci --omit=dev
  npm run fix:enums
  pm2 restart gestion-backend --update-env

- Frontend:
  cd /var/www/gestion_de_pedidos/frontend
  npm ci
  npm run build
  sudo rsync -a --delete build/ /var/www/gestion-frontend/
  sudo systemctl reload nginx

- Revisar:
  curl -i http://127.0.0.1/api/health
  pm2 logs gestion-backend --lines 120 --nostream

-------------------------------------------------------------------------------

## 5) Desarrollo (localhost)

Requisitos:
- Node.js 18+ o 20+, npm
- MySQL/MariaDB local

Base de datos:
- Crea una base local (ejemplo): gestion_pedidos_dev
- Crea usuario para desarrollo o usa root (según tu ambiente)

Backend/.env (ejemplo rápido):
PORT=3001
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=gestion_pedidos_dev
JWT_SECRET=dev_secret
JWT_EXPIRES_IN=24h
FRONTEND_URL=http://localhost:3000
SIIGO_ENABLED=true
SIIGO_API_USERNAME=
SIIGO_API_ACCESS_KEY=
SIIGO_API_BASE_URL=https://api.siigo.com
SIIGO_PARTNER_ID=siigo
SIIGO_WEBHOOK_SECRET=dev-webhook-secret
SIIGO_AUTO_SYNC=false
SIIGO_SYNC_INTERVAL=5

Instalación y arranque:
1) Backend
   cd backend
   npm ci
   npm run fix:enums       # migra/crea tablas necesarias de forma portable
   npm run dev             # backend en http://localhost:3001

2) Frontend
   cd frontend
   npm ci

   Opción A (usar proxy CRA – actualmente proxy apunta a http://localhost:3002):
   - Cambia temporalmente "proxy" en frontend/package.json a "http://localhost:3001"
     o inicia backend en 3002.
   npm start

   Opción B (forzar URL explícita):
   - Crea frontend/.env.local con:
     REACT_APP_API_URL=http://localhost:3001/api
   npm start

Frontend dev: http://localhost:3000
API dev health: http://localhost:3001/api/health

-------------------------------------------------------------------------------

## 6) Notas de arquitectura para múltiples clientes (SIIGO y escalabilidad)

- Normalización de métodos de pago:
  El backend mapea paymentMethod='auto' al ENUM válido de la BD automáticamente (siigoService).
- Tolerancia de ENUMs en logs:
  Si la BD no soporta sync_type='update', se usa 'manual' como fallback.
- Migración portable y postinstall:
  scripts/fix_enums_portable.js asegura que orders.payment_method y siigo_sync_log existan y soporten los ENUMs requeridos. Se puede invocar manualmente con npm run fix:enums y también se invoca automáticamente por postinstall del backend.
- Frontend en producción:
  Utiliza '/api' same‑origin por diseño; no depende de dominios codificados. Nginx hace proxy al backend.
- Variables SIIGO por cliente:
  Puedes usar siigo_credentials en BD (panel) o .env; el código ya maneja ambas rutas de configuración.

-------------------------------------------------------------------------------

## 7) Comandos útiles

- Reiniciar backend y ver logs:
  pm2 restart gestion-backend --update-env
  pm2 logs gestion-backend --lines 120 --nostream

- Revisar Nginx:
  sudo nginx -t && sudo systemctl reload nginx
  sudo tail -n 200 /var/log/nginx/error.log

- Salud API local:
  curl -i http://127.0.0.1/api/health

-------------------------------------------------------------------------------

Con este instalador y la migración portable, puedes desplegar de forma repetible en distintos VPS/empresas. El frontend se auto‑configura para usar '/api' en producción, y las normalizaciones en backend evitan errores por discrepancias de ENUM entre instalaciones.
