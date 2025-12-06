# Despliegue: Cartera en paralelo (bodega_eligible) para 72.60.175.159

Este despliegue habilita que Cartera vea y cobre pedidos Recoge en Bodega + Efectivo en paralelo, aun si Logística no ha registrado el cobro (botón "Registrar Pago").

Cambios incluidos
- backend/controllers/carteraController.js (nuevo bloque bodega_eligible)
- frontend/src/pages/CashierCollectionsPage.js (botón Registrar Pago y columna Recibido por)
- Scripts de verificación (opcionales):
  - backend/scripts/check_cartera_pending_by_number.js
  - backend/scripts/debug_cartera_pending_preview.js

1) Subir archivos al servidor
Ejecutar desde tu máquina local (reemplazar USER por tu usuario SSH):

```
# Backend
scp backend/controllers/carteraController.js USER@72.60.175.159:/var/www/gestion_de_pedidos/backend/controllers/carteraController.js

# Frontend (React)
scp frontend/src/pages/CashierCollectionsPage.js USER@72.60.175.159:/var/www/gestion_de_pedidos/frontend/src/pages/CashierCollectionsPage.js

# (Opcional) Scripts de prueba en servidor
scp backend/scripts/check_cartera_pending_by_number.js USER@72.60.175.159:/var/www/gestion_de_pedidos/backend/scripts/check_cartera_pending_by_number.js
scp backend/scripts/debug_cartera_pending_preview.js USER@72.60.175.159:/var/www/gestion_de_pedidos/backend/scripts/debug_cartera_pending_preview.js
```

2) Conectarse al servidor y build del frontend

```
ssh USER@72.60.175.159
cd /var/www/gestion_de_pedidos

# (Opcional) Verificar que el código llegó
sed -n '1,120p' backend/controllers/carteraController.js | head -n 20
sed -n '1,120p' frontend/src/pages/CashierCollectionsPage.js | head -n 20

# Instalar dependencias si hace falta
cd frontend
npm install
npm run build

# Verificar que Nginx sirve /var/www/gestion_de_pedidos/frontend/build (ya configurado)
ls -la /var/www/gestion_de_pedidos/frontend/build
```

3) Reiniciar backend (elige el método que usas)

```
# Si usas pm2
pm2 status
pm2 reload all || pm2 restart all

# Si usas systemd (ajusta el nombre del servicio)
sudo systemctl restart gestion-pedidos || sudo systemctl restart node-backend

# Si ejecutas node manualmente (no recomendado):
# pkill -f "node .*backend/server.js"; nohup node /var/www/gestion_de_pedidos/backend/server.js >/var/log/gestion/backend.log 2>&1 &
```

4) Validación rápida en servidor

```
# Ver que la API responde y lista elegibles (sin token si el endpoint es público, de lo contrario usa token)
curl -s http://127.0.0.1:3001/api/cartera/pending | head -c 2000

# (Opcional) Verificar elegibles por número
node /var/www/gestion_de_pedidos/backend/scripts/debug_cartera_pending_preview.js FV-2-15021
```

5) Validar en la UI
- Ir a: http://72.60.175.159/cashier-collections
- Sin filtros y pulsar “Actualizar”.
- Deberías ver FV-2-15021 como pendiente con source=bodega_eligible y el botón “Registrar Pago”.
- Si Cartera pulsa “Registrar Pago”, se crea el cash_register (accepted si el usuario es Cartera/Admin) y se mueve al consolidado diario de Bodega.

6) (Opcional) Registrar pago por API (sin UI)
Requiere token Bearer válido.

```
# Suponiendo que TOKEN es un JWT válido
curl -X POST http://72.60.175.159/api/logistics/receive-pickup-payment \
  -H "Authorization: Bearer TOKEN" \
  -F orderId=231 \
  -F payment_method=efectivo \
  -F amount=424400 \
  -F notes="Registrado desde Cartera (deploy test)"
```

Notas
- Nginx ya sirve el build del frontend en /var/www/gestion_de_pedidos/frontend/build.
- Si el frontend no refleja cambios, fuerza recarga (Ctrl+F5) o borra caché del navegador.
- Si el endpoint /api/cartera/pending responde 401, usa un token de un usuario con rol cartera/admin.

Rollback rápido
- Si algo falla, puedes restaurar los dos archivos desde el repositorio anterior y reconstruir el frontend:
```
# Ejemplo (ajusta con tus rutas/ramas)
git checkout -- backend/controllers/carteraController.js
# restaurar componente (o copiar la versión previa)
# Luego: cd frontend && npm run build && reinicia backend
```
