# Guía de instalación mínima desde cero (Ubuntu limpio)

Este documento te permite instalar “Gestión de Pedidos” en un servidor Ubuntu sin configuraciones previas. Deja:
- Nginx en HTTP (sin HTTPS por ahora)
- MySQL listo con base de datos y usuario
- PHP-FPM + phpMyAdmin SIN protección adicional (solo para pruebas)
- Node.js 18 + PM2
- Backend corriendo con PM2, Frontend compilado
- Usuario de la app: admin / admin123
- Tabla `siigo_credentials` creada (para guardar credenciales desde la UI)

Al final podrás entrar a la app y guardar las credenciales de SIIGO desde Admin → Integraciones.

IMPORTANTE: Este setup es “mínimo” para levantar rápido. Luego aplicaremos seguridad en “Fase 2” (HTTPS, BasicAuth, firewall).

---

Variables de ejemplo (ajústalas si deseas):
- IP del servidor: 46.202.93.54
- Base de datos: gestion_pedidos_dev
- Usuario MySQL: gp_user
- Password MySQL: gp_password

Si cambias estos valores, reemplázalos en los comandos.

## 0) Conéctate por SSH
```bash
ssh ubuntu@46.202.93.54
```

## 1) Instala git y curl (necesarios para clonar y ejecutar el instalador)
```bash
sudo apt update
sudo apt install -y git curl
```

## 2) Clona el repositorio en /var/www/gestion_de_pedidos
```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/jecaicedo27/gestion_de_pedidos.git
cd gestion_de_pedidos
```

## 3) Ejecuta el instalador mínimo “todo en uno”
Este script instalará Nginx, MySQL, PHP-FPM, phpMyAdmin, Node 18 y PM2; creará la BD y usuario; generará backend/.env; instalará dependencias; compilará frontend; creará el site Nginx (HTTP) y levantará el backend con PM2; además hará el bootstrap de la BD (tabla `siigo_credentials` + usuario admin).
```bash
sudo bash deploy/scripts/fresh_install_minimal.sh 46.202.93.54 gestion_pedidos_dev gp_user "gp_password"
```

Qué hace internamente:
- Instala: nginx, mysql-server, php-fpm, php-mysql, phpmyadmin, git, nodejs 18, pm2
- Crea DB y usuario:
  - DB: gestion_pedidos_dev
  - User: gp_user / Pass: gp_password
- Clona/actualiza el repo en /var/www/gestion_de_pedidos
- Genera backend/.env con DB, `JWT_SECRET` y `CONFIG_ENCRYPTION_KEY`
- Instala dependencias backend y frontend; compila frontend
- Configura Nginx (HTTP) y expone `/phpmyadmin` sin auth (solo pruebas)
- Arranca backend con PM2 (“gestion-backend”)
- Crea tabla `siigo_credentials` y asegura usuario `admin/admin123`

## 4) Verifica que todo levantó
- Estado del proceso backend:
```bash
pm2 status
pm2 logs gestion-backend --lines 80
```

- Probar sintaxis de Nginx:
```bash
sudo nginx -t
```

- (Opcional) Probar phpMyAdmin localmente desde el servidor:
```bash
curl -I http://127.0.0.1/phpmyadmin
```

## 5) Abre las URLs en tu navegador
- App (login):  
  http://46.202.93.54/login

- phpMyAdmin (sin protección adicional por ahora):  
  http://46.202.93.54/phpmyadmin

Credenciales phpMyAdmin (Base de Datos):
- Servidor: `localhost`
- Usuario:  `gp_user`
- Password: `gp_password`

## 6) Entra a la app y configura SIIGO
- Usuario de la app (creado por el instalador): `admin`
- Contraseña: `admin123`

En la app: Admin → Integraciones (API Config) → SIIGO
- Usuario SIIGO
- Access Key
- URL base: `https://api.siigo.com/v1`
- Webhook secret (opcional)
- Habilitar integración

Esto persiste en la tabla `siigo_credentials` (access_key cifrada con AES-256-GCM).

## 7) (Opcional) Probar autenticación por API en el servidor
```bash
curl -s -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  http://127.0.0.1:3001/api/auth/login
```
Debería devolver un JSON con un `token` JWT.

## 8) Solución de problemas rápida
- Ver logs del backend:
```bash
pm2 logs gestion-backend --lines 200
```

- Reiniciar backend si fuera necesario:
```bash
pm2 restart gestion-backend
```

- Estado de Nginx:
```bash
sudo systemctl status nginx
```

- Probar/recargar Nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

- Acceso root MySQL por socket (suele no requerir contraseña en Ubuntu recién instalado):
```bash
sudo mysql -uroot -e "SHOW DATABASES;"
```

## 9) Fase 2 (seguridad, cuando todo funcione)
Cuando confirmes que la app funciona y puedes guardar SIIGO, aplica seguridad:
- HTTPS con Let’s Encrypt (certbot)
- BasicAuth y/o restricción por IP para `/phpmyadmin`
- Firewall (ufw) para cerrar todo excepto lo necesario
- endurecer MySQL (root password, bind-address, etc.)

---

## One-liner (instalación rápida)
Si prefieres, en un servidor vacío puedes ejecutar esto (usa los valores por defecto del ejemplo):
```bash
sudo apt update && sudo apt install -y git curl && \
sudo mkdir -p /var/www && cd /var/www && \
sudo git clone https://github.com/jecaicedo27/gestion_de_pedidos.git || true && \
cd gestion_de_pedidos && \
sudo bash deploy/scripts/fresh_install_minimal.sh 46.202.93.54 gestion_pedidos_dev gp_user "gp_password"
```

Al finalizar:
- App: http://46.202.93.54/login (admin/admin123)
- phpMyAdmin: http://46.202.93.54/phpmyadmin (localhost / gp_user / gp_password)
- Backend por PM2: `gestion-backend`

Listo. Con esto tienes la instalación mínima, funcional y reproducible solo con copiar/pegar comandos.
