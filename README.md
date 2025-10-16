# Sistema de Gestión de Pedidos Universal

Sistema completo de gestión de pedidos universal para cualquier empresa con backend Node.js, frontend React y base de datos MySQL.

## Características

- **Backend**: Node.js + Express + MySQL
- **Frontend**: React + Tailwind CSS
- **Base de datos**: MySQL con migraciones completas
- **Autenticación**: JWT con roles (admin, facturador, cartera, logistica, mensajero)
- **Configuración**: Multi-empresa con variables de entorno

## Estructura del Proyecto

```
gestion_de_pedidos/
├── backend/          # Servidor Node.js (puerto 3001)
├── frontend/         # Aplicación React (puerto 3000)
├── database/         # Migraciones MySQL
├── scripts/          # Scripts de setup y configuración
└── package.json      # Scripts principales
```

## Instalación y Configuración

### Prerrequisitos

- Node.js (v16 o superior)
- MySQL (XAMPP recomendado)
- npm o yarn

### Configuración Inicial

1. **Clonar e instalar dependencias:**
   ```bash
   npm run install:all
   ```

2. **Configurar base de datos:**
   - Iniciar MySQL (XAMPP)
   - Crear base de datos: `gestion_pedidos_dev`
   - Ejecutar migraciones:
   ```bash
   npm run migrate
   ```

3. **Configurar variables de entorno:**
   - Copiar `.env.example` a `.env` en backend/
   - Ajustar configuración de base de datos

## Scripts Disponibles

- `npm run dev` - Iniciar desarrollo (backend + frontend)
- `npm run migrate` - Crear/actualizar base de datos
- `npm run build` - Build de producción
- `npm run setup` - Instalación completa + migraciones

## Configuración por Defecto

- **Usuario admin**: admin / admin123
- **Base de datos**: gestion_pedidos_dev
- **Puerto backend**: 3001
- **Puerto frontend**: 3000

## Roles de Usuario

- **admin**: Gestión completa del sistema
- **facturador**: Crear y gestionar pedidos
- **cartera**: Gestión de pagos y cobranza
- **logistica**: Gestión de inventario y despachos
- **mensajero**: Gestión de entregas

## Funcionalidades

1. Login/logout con JWT
2. Dashboard personalizado por rol
3. Gestión completa de pedidos
4. Gestión de usuarios (admin)
5. Configuración dinámica por empresa
6. Sistema de estados de pedidos
7. Reportes y estadísticas

## Desarrollo

Para desarrollo local con XAMPP:

1. Iniciar XAMPP (Apache + MySQL)
2. Ejecutar `npm run setup`
3. Ejecutar `npm run dev`
4. Acceder a http://localhost:3000

## Licencia

MIT
