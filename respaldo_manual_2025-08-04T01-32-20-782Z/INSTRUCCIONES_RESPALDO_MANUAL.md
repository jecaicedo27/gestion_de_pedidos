# 🚨 RESPALDO MANUAL URGENTE DE GESTION_PEDIDOS_DEV
Fecha: 2025-08-04T01:32:20.789Z

## ⚠️ SITUACIÓN ACTUAL:
- MySQL no está ejecutándose
- No se puede hacer respaldo automático
- Es CRÍTICO respaldar antes de desinstalar XAMPP

## 🔧 OPCIONES DE RESPALDO (EN ORDEN DE PRIORIDAD):

### OPCIÓN 1: COPIAR ARCHIVOS DE DATOS (MÁS SEGURA)
1. Ve a: C:\xampp\mysql\data
2. Busca la carpeta "gestion_pedidos_dev"
3. COPIA COMPLETA la carpeta "gestion_pedidos_dev" a este directorio: ./respaldo_manual_2025-08-04T01-32-20-782Z
4. También copia los archivos: ib_logfile0, ib_logfile1, ibdata1 (si existen)

### OPCIÓN 2: FORZAR INICIO DE MYSQL TEMPORALMENTE
1. Abre XAMPP Control Panel como ADMINISTRADOR
2. En MySQL, haz clic en "Config" → "my.ini"
3. Al final del archivo, agrega estas líneas:
   [mysqld_safe]
   skip-grant-tables
   skip-networking
4. Guarda y cierra el archivo
5. Haz clic en "Start" en MySQL
6. SI INICIA, ejecuta inmediatamente:
   - Ve a http://localhost/phpmyadmin
   - Selecciona "gestion_pedidos_dev"
   - Clic en "Exportar"
   - Descarga el archivo SQL
7. Detén MySQL y quita las líneas agregadas en my.ini

### OPCIÓN 3: USAR HERRAMIENTAS EXTERNAS
1. Descarga MySQL Workbench
2. Conéctate a localhost:3306 (usuario: root, sin contraseña)
3. Ve a Server > Data Export
4. Selecciona "gestion_pedidos_dev"
5. Exporta a archivo SQL

### OPCIÓN 4: REINSTALAR XAMPP SIN DESINSTALAR
1. Descarga la versión más reciente de XAMPP
2. Instálala en una carpeta diferente (ej: C:\xampp_nuevo\)
3. Copia los datos desde la instalación antigua
4. Una vez verificado, desinstala la versión antigua

## 📊 DATOS CRÍTICOS A PROTEGER:

### PEDIDO 12580 (PRIORIDAD MÁXIMA):
- Verificar que existe en la tabla "orders"
- Estado actual debe preservarse
- Items asociados en tabla "order_items"

### TABLAS CRÍTICAS:
- orders (todos los pedidos)
- order_items (productos de pedidos)
- users (usuarios del sistema)
- system_config (configuración)
- company_config (configuración empresa)
- delivery_methods (métodos de entrega)

## 🔄 DESPUÉS DE REINSTALAR XAMPP:

### 1. Si tienes archivo SQL:
1. Abre phpMyAdmin (http://localhost/phpmyadmin)
2. Crea base de datos "gestion_pedidos_dev"
3. Importa el archivo SQL

### 2. Si tienes carpeta de datos:
1. Para MySQL en XAMPP nuevo
2. Ve a C:\xampp\mysql\data\
3. Copia la carpeta "gestion_pedidos_dev" aquí
4. Reinicia MySQL

### 3. Verificar restauración:
1. Ejecuta: node consultar_pedido_12580_directo.js
2. Confirma que el pedido 12580 existe
3. Verifica su estado actual

## 🆘 EN CASO DE EMERGENCIA:
Si pierdes los datos, tenemos algunas copias parciales en:
- Logs de la aplicación (pueden tener información del pedido)
- Respaldos automáticos anteriores (si existen)
- Caché de la aplicación (datos temporales)

## 📞 CONTACTO DE EMERGENCIA:
- Equipo de desarrollo
- Administrador de sistemas
- Gerencia (para decisiones críticas)

RECUERDA: Es mejor hacer MÚLTIPLES respaldos que ninguno.
¡NO DESINSTALES XAMPP SIN RESPALDAR PRIMERO!
