# Exportación Completa de Base de Datos - Gestión de Pedidos

## 📦 Archivo de Exportación

**Archivo:** `gestion_pedidos_complete_2026-01-10.sql`  
**Tamaño:** 32.88 MB  
**Base de datos:** `gestion_pedidos_dev_4`

## 📋 Contenido Incluido

Esta exportación contiene **TODO** lo necesario para replicar el sistema completo:

✅ **Estructura de Base de Datos**
- Todas las tablas con sus definiciones
- Índices y claves foráneas
- Constraints y relaciones

✅ **Datos Completos**
- Usuarios y roles
- Productos (con información de Siigo)
- Clientes
- Pedidos históricos
- Inventario
- Configuraciones del sistema
- Mensajeros y transportistas
- Categorías de productos
- Y todos los demás datos operativos

✅ **Objetos de Base de Datos**
- Stored Procedures
- Functions
- Triggers
- Eventos programados

## 🚀 Cómo Importar en un Nuevo Servidor

### Paso 1: Crear la Base de Datos

```bash
mysql -u root -p
```

```sql
CREATE DATABASE gestion_pedidos_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

### Paso 2: Importar el Dump

```bash
mysql -u root -p gestion_pedidos_dev < gestion_pedidos_complete_2026-01-10.sql
```

Esto puede tomar algunos minutos debido al tamaño del archivo.

### Paso 3: Verificar la Importación

```bash
mysql -u root -p gestion_pedidos_dev
```

```sql
-- Verificar tablas
SHOW TABLES;

-- Verificar usuarios
SELECT COUNT(*) as total_usuarios FROM users;

-- Verificar productos
SELECT COUNT(*) as total_productos FROM products;

-- Verificar pedidos
SELECT COUNT(*) as total_pedidos FROM orders;
```

## 🔄 Actualizar la Configuración del Backend

Después de importar, actualiza el archivo `backend/.env`:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_contraseña
DB_NAME=gestion_pedidos_dev
```

## 📊 Datos Incluidos

Esta exportación incluye datos reales de producción hasta el **10 de enero de 2026**, incluyendo:

- **Usuarios:** Todos los usuarios del sistema con sus roles
- **Productos:** Catálogo completo sincronizado con Siigo
- **Clientes:** Base de datos completa de clientes
- **Pedidos:** Historial completo de pedidos
- **Inventario:** Estado actual del inventario
- **Mensajeros:** Configuración de mensajeros y transportistas

## ⚠️ Notas Importantes

1. **Contraseñas de Usuarios:** Las contraseñas están hasheadas con bcrypt
2. **Credenciales de Siigo:** Deberás configurar tus propias credenciales de Siigo en las variables de entorno
3. **Archivos Estáticos:** Esta exportación NO incluye archivos subidos (imágenes, PDFs, etc.). Esos están en `/var/www/gestion_de_pedidos/uploads/`
4. **Tamaño:** El archivo es grande (32.88 MB) debido a la cantidad de datos históricos

## 🔧 Script de Exportación

El script `export_complete_database.js` se puede usar para crear nuevas exportaciones:

```bash
node database/export_complete_database.js
```

Esto generará un nuevo archivo SQL con la fecha actual.

## 💡 Casos de Uso

Esta exportación es ideal para:

- ✅ Configurar un entorno de desarrollo local
- ✅ Crear un servidor de staging
- ✅ Backup completo del sistema
- ✅ Migración a un nuevo servidor
- ✅ Población inicial con datos reales
- ✅ Testing con datos de producción

## 🆘 Solución de Problemas

### Error de Permisos

Si obtienes un error de permisos al importar:

```sql
GRANT ALL PRIVILEGES ON gestion_pedidos_dev.* TO 'tu_usuario'@'localhost';
FLUSH PRIVILEGES;
```

### Error de Charset

Si hay problemas con caracteres especiales, asegúrate de usar UTF-8:

```bash
mysql -u root -p --default-character-set=utf8mb4 gestion_pedidos_dev < gestion_pedidos_complete_2026-01-10.sql
```

### Importación Lenta

Para archivos grandes, puedes desactivar temporalmente algunos checks:

```sql
SET FOREIGN_KEY_CHECKS=0;
SET UNIQUE_CHECKS=0;
SOURCE gestion_pedidos_complete_2026-01-10.sql;
SET FOREIGN_KEY_CHECKS=1;
SET UNIQUE_CHECKS=1;
```

---

**Última actualización:** 10 de enero de 2026  
**Generado por:** export_complete_database.js
