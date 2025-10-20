# 🔒 Guía de Configuración Segura - Sistema de Gestión de Pedidos

## ⚠️ IMPORTANTE: Credenciales Actuales Comprometidas

Las credenciales actuales de SIIGO y WhatsApp han sido expuestas en el repositorio de Git. Es **CRÍTICO** que realice los siguientes pasos:

### 1. **Cambiar Credenciales Inmediatamente**

#### SIIGO:
- Contactar a SIIGO para solicitar nuevas credenciales
- Usuario actual comprometido: `COMERCIAL@PERLAS-EXPLOSIVAS.COM`
- Solicitar nuevo `access_key`

#### WhatsApp (Wapify):
- Contactar a Wapify para regenerar el token API
- Token actual comprometido: `1061730.Q7e7SryrtAk6oJifb2SUiMhhSPqdlC`

## 📋 Pasos de Configuración Segura

### Paso 1: Configurar Variables de Entorno

1. Copiar el archivo de ejemplo:
```bash
cd backend
cp .env.example .env
```

2. Editar el archivo `.env` con las nuevas credenciales:
```
# JWT Secret generado (usar este o generar uno nuevo)
JWT_SECRET=57a88ffc525f8a4dcd3c9ce7c23a6878e1084abda5223372b5ba77db51b2fe17f5cb70ffddd7af9052173e99fc79fbb1eb96c79b43618f7ca4f4cc767d49ccc01

# Nuevas credenciales de SIIGO (solicitar a SIIGO)
SIIGO_API_USERNAME=nuevo_usuario@perlas-explosivas.com
SIIGO_API_ACCESS_KEY=nueva_clave_de_acceso_segura

# Nuevo token de WhatsApp (solicitar a Wapify)
WAPIFY_API_TOKEN=nuevo_token_seguro
```

### Paso 2: Configurar Base de Datos

1. Cambiar contraseña del usuario MySQL
2. Actualizar la contraseña en el archivo `.env`

### Paso 3: Cambiar Contraseñas de Usuarios

Ejecutar el siguiente script SQL para cambiar todas las contraseñas:

```sql
USE gestion_pedidos_dev;

-- Cambiar contraseñas (reemplazar con hashes bcrypt reales)
UPDATE users SET password = '$2a$10$NuevaContraseñaHasheada' WHERE username = 'admin';
UPDATE users SET password = '$2a$10$NuevaContraseñaHasheada' WHERE username = 'facturador1';
UPDATE users SET password = '$2a$10$NuevaContraseñaHasheada' WHERE username = 'cartera1';
UPDATE users SET password = '$2a$10$NuevaContraseñaHasheada' WHERE username = 'logistica1';
UPDATE users SET password = '$2a$10$NuevaContraseñaHasheada' WHERE username = 'empacador1';
UPDATE users SET password = '$2a$10$NuevaContraseñaHasheada' WHERE username = 'mensajero1';
```

## 🛡️ Mejores Prácticas de Seguridad

### 1. **Gestión de Credenciales**
- ✅ NUNCA subir archivos `.env` a Git
- ✅ Usar variables de entorno diferentes para desarrollo/producción
- ✅ Rotar credenciales regularmente
- ✅ Usar gestores de secretos en producción (AWS Secrets Manager, Azure Key Vault, etc.)

### 2. **Contraseñas Seguras**
- ✅ Mínimo 12 caracteres
- ✅ Combinar mayúsculas, minúsculas, números y símbolos
- ✅ No usar información personal o de la empresa
- ✅ Cambiar cada 90 días

### 3. **Acceso a Base de Datos**
- ✅ Crear usuario específico para la aplicación (no usar root)
- ✅ Limitar permisos solo a la base de datos necesaria
- ✅ Usar conexiones SSL en producción

### 4. **Monitoreo**
- ✅ Revisar logs regularmente
- ✅ Configurar alertas para accesos no autorizados
- ✅ Auditar cambios en configuración

## 🚀 Configuración para Producción

### 1. Variables de Entorno en Servidor
```bash
# En el servidor de producción
export JWT_SECRET="valor_seguro_generado"
export SIIGO_API_USERNAME="usuario_produccion"
export SIIGO_API_ACCESS_KEY="clave_produccion"
export WAPIFY_API_TOKEN="token_produccion"
```

### 2. Configuración de Nginx (HTTPS)
```nginx
server {
    listen 443 ssl;
    server_name tudominio.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Firewall
- Solo abrir puertos necesarios (80, 443)
- Restringir acceso SSH a IPs específicas
- Configurar fail2ban para prevenir ataques

## 📞 Contactos para Soporte

### SIIGO
- Soporte técnico: [URL de soporte SIIGO]
- Teléfono: [Número de SIIGO]
- Email: soporte@siigo.com

### Wapify
- Portal: https://ap.whapify.ai
- Documentación API: [URL documentación]
- Soporte: [Email de soporte]

## ⏰ Acciones Inmediatas Requeridas

1. [ ] Cambiar credenciales de SIIGO (URGENTE)
2. [ ] Cambiar token de Wapify (URGENTE)
3. [ ] Generar nuevo JWT_SECRET
4. [ ] Cambiar contraseñas de todos los usuarios
5. [ ] Cambiar contraseña de MySQL
6. [ ] Configurar variables de entorno en servidor de producción
7. [ ] Implementar HTTPS
8. [ ] Configurar backups automáticos

---

**NOTA IMPORTANTE**: Este documento contiene información sensible. Mantenerlo seguro y no compartirlo públicamente.

Fecha de creación: 8 de Agosto 2025
