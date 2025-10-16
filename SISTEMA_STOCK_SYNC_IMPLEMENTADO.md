# 🔄 SISTEMA DE SINCRONIZACIÓN DE STOCK CON WEBHOOKS

## ✅ ESTADO: COMPLETAMENTE IMPLEMENTADO

El sistema de sincronización de stock ha sido implementado completamente y está listo para su uso. Solo requiere configuración de credenciales de SIIGO para activarse.

---

## 🏗️ ARQUITECTURA DEL SISTEMA

### 📦 Componentes Implementados

1. **StockSyncService** (`backend/services/stockSyncService.js`)
   - Sincronización programada cada 5 minutos
   - Autenticación automática con SIIGO
   - Rate limiting inteligente
   - Renovación automática de tokens
   - Notificaciones WebSocket en tiempo real

2. **WebhookService** (`backend/services/webhookService.js`)
   - Suscripción automática a webhooks de SIIGO
   - Procesamiento de eventos en tiempo real
   - Logs completos de actividad
   - Manejo de errores robusto

3. **Rutas de Webhooks** (`backend/routes/webhooks.js`)
   - `POST /api/webhooks/receive` - Recibir webhooks de SIIGO
   - `POST /api/webhooks/setup` - Configurar webhooks
   - `GET /api/webhooks/subscriptions` - Ver suscripciones activas
   - `GET /api/webhooks/logs` - Logs de webhooks
   - `POST /api/webhooks/test` - Endpoint de pruebas

4. **Base de Datos**
   - `webhook_subscriptions` - Suscripciones activas
   - `webhook_logs` - Logs de todos los eventos
   - Índices optimizados para consultas rápidas
   - Columnas de timestamp para auditoría

5. **Integración con Servidor**
   - Inicio automático con el servidor backend
   - Integración con WebSocket para notificaciones
   - Manejo de errores sin afectar otras funciones

---

## 🔧 CONFIGURACIÓN REQUERIDA

### Variables de Entorno (.env)

```env
# SIIGO API Configuration
SIIGO_ENABLED=true
SIIGO_USERNAME=tu_usuario_siigo
SIIGO_ACCESS_KEY=tu_access_key_siigo
SIIGO_PARTNER_ID=tu_partner_id_siigo

# Webhook Configuration
WEBHOOK_BASE_URL=https://tu-dominio.com/api/webhooks
# Para desarrollo local: WEBHOOK_BASE_URL=http://localhost:5000/api/webhooks
```

### Configuración de Puerto del Servidor

El sistema está configurado para ejecutarse en el puerto **5000** por defecto:
- Backend: `http://localhost:5000`
- Webhooks: `http://localhost:5000/api/webhooks/receive`

---

## 🚀 ACTIVACIÓN DEL SISTEMA

### Opción 1: Automático (Recomendado)
```bash
# El sistema se activa automáticamente cuando inicias el backend
npm start
```

### Opción 2: Script de Configuración Completa
```bash
# Script de configuración y activación completa
node activate_complete_stock_sync_system.js
```

---

## 📊 FUNCIONALIDADES IMPLEMENTADAS

### 🔄 Sincronización Programada
- **Frecuencia**: Cada 5 minutos
- **Rate Limiting**: 200ms entre requests
- **Batch Processing**: 50 productos por lote
- **Auto-recovery**: Recuperación automática de errores
- **Token Management**: Renovación automática de tokens

### 🔔 Webhooks en Tiempo Real
- **Eventos Soportados**:
  - `public.siigoapi.products.stock.update` - Actualización de stock
  - `public.siigoapi.products.update` - Actualización de producto  
  - `public.siigoapi.products.create` - Creación de producto

### 📡 Notificaciones WebSocket
```javascript
// Los clientes reciben notificaciones en tiempo real
{
  productId: 123,
  siigoProductId: "PROD001",
  productName: "Producto Ejemplo",
  oldStock: 10,
  newStock: 15,
  source: "webhook", // o "scheduled_sync"
  timestamp: "2025-01-20T10:30:00.000Z"
}
```

### 📝 Sistema de Logs
- **Webhook Logs**: Todos los eventos recibidos
- **Sync Logs**: Historial de sincronizaciones
- **Error Handling**: Logs detallados de errores
- **Audit Trail**: Rastro completo de cambios

---

## 🛠️ API ENDPOINTS DISPONIBLES

### Configuración de Webhooks
```http
POST /api/webhooks/setup
Authorization: Bearer {token}

# Configura automáticamente todos los webhooks necesarios
```

### Consultar Estado
```http
GET /api/webhooks/subscriptions
Authorization: Bearer {token}

# Retorna todas las suscripciones activas
```

### Ver Logs
```http
GET /api/webhooks/logs?limit=100
Authorization: Bearer {token}

# Retorna los últimos logs de webhooks
```

### Test de Webhooks
```http
POST /api/webhooks/test
Authorization: Bearer {token}
Content-Type: application/json

{
  "product_id": "TEST001",
  "new_stock": 25
}
```

---

## 📈 MONITOREO Y ESTADÍSTICAS

### Dashboard de Estado
El sistema proporciona estadísticas completas:

```javascript
{
  products: {
    total_products: 589,
    synced_products: 589,
    updated_today: 45,
    avg_stock: 125,
    last_sync_time: "2025-01-20T10:25:00Z"
  },
  webhooks: {
    total_webhooks: 1250,
    processed_webhooks: 1248,
    webhooks_last_hour: 15
  },
  webhooksConfigured: true,
  syncRunning: true
}
```

---

## 🔒 SEGURIDAD Y RATE LIMITING

### Protección de Endpoints
- **Rate Limiting**: Configurado para todos los endpoints
- **Autenticación**: JWT para endpoints administrativos
- **CORS**: Configurado para frontend específico
- **Validation**: Validación completa de payloads

### Manejo de Errores
- **Retry Logic**: Reintentos automáticos
- **Circuit Breaker**: Protección contra fallos en cadena
- **Graceful Degradation**: Continúa funcionando sin webhooks si es necesario

---

## 🚦 FLUJO DE FUNCIONAMIENTO

### 1. Sincronización Programada (Cada 5 minutos)
```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│ Timer (5 min)   │ ──▶│ Get Products │ ──▶│ Check SIIGO API │
└─────────────────┘    └──────────────┘    └─────────────────┘
                                                     │
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│ Update Database │ ◀──│ Compare Stock│ ◀──│ Process Response│
└─────────────────┘    └──────────────┘    └─────────────────┘
```

### 2. Webhooks en Tiempo Real
```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│ SIIGO Change    │ ──▶│ Webhook POST │ ──▶│ Process Payload │
└─────────────────┘    └──────────────┘    └─────────────────┘
                                                     │
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│ WebSocket Event │ ◀──│ Update DB    │ ◀──│ Validate & Log  │
└─────────────────┘    └──────────────┘    └─────────────────┘
```

---

## 🔧 TROUBLESHOOTING

### Problemas Comunes

1. **Error: Missing SIIGO credentials**
   ```bash
   # Solución: Configura las variables de entorno
   SIIGO_USERNAME=tu_usuario
   SIIGO_ACCESS_KEY=tu_key
   SIIGO_PARTNER_ID=tu_partner_id
   ```

2. **Webhooks no llegan**
   ```bash
   # Verifica la URL configurada
   WEBHOOK_BASE_URL=https://tu-dominio.com/api/webhooks
   
   # Para desarrollo, usa ngrok:
   ngrok http 5000
   # Luego usa la URL de ngrok en WEBHOOK_BASE_URL
   ```

3. **Error de conexión a SIIGO**
   ```bash
   # Verifica las credenciales en SIIGO
   # Asegúrate de que el partner_id sea correcto
   ```

### Logs de Debug
```bash
# Los logs del sistema aparecen en la consola del backend
# Busca mensajes que empiecen con:
# 🔄 (sincronización)
# 🔔 (webhooks) 
# ❌ (errores)
# ✅ (éxito)
```

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

- [x] ✅ **StockSyncService** - Sincronización cada 5 minutos
- [x] ✅ **WebhookService** - Manejo de webhooks de SIIGO
- [x] ✅ **Database Schema** - Tablas y índices optimizados
- [x] ✅ **API Routes** - Endpoints completos para webhooks
- [x] ✅ **Server Integration** - Integrado al servidor backend
- [x] ✅ **WebSocket Support** - Notificaciones en tiempo real
- [x] ✅ **Error Handling** - Manejo robusto de errores
- [x] ✅ **Rate Limiting** - Protección contra exceso de requests
- [x] ✅ **Logging System** - Logs completos y auditoría
- [x] ✅ **Configuration Script** - Script de configuración automática
- [ ] ⏳ **SIIGO Credentials** - Pendiente de configuración
- [ ] ⏳ **Production Deployment** - Pendiente de despliegue

---

## 🎯 SIGUIENTE PASOS

1. **Obtener credenciales de SIIGO**
   - Contactar a SIIGO para obtener API credentials
   - Configurar webhook URL en producción

2. **Configurar variables de entorno**
   - Agregar credenciales al archivo `.env`
   - Configurar URL de webhooks para producción

3. **Activar el sistema**
   ```bash
   node activate_complete_stock_sync_system.js
   ```

4. **Verificar funcionamiento**
   - Revisar logs de sincronización
   - Confirmar recepción de webhooks
   - Monitorear estadísticas

---

## 🏆 BENEFICIOS DEL SISTEMA

### ⚡ **Tiempo Real**
- Actualizaciones instantáneas vía webhooks
- Notificaciones WebSocket para UI reactiva
- Sincronización cada 5 minutos como respaldo

### 🛡️ **Confiabilidad** 
- Doble sistema: webhooks + sincronización programada
- Manejo de errores robusto
- Logs completos para debugging

### 📊 **Monitoreo**
- Estadísticas detalladas del sistema
- Historial completo de cambios
- Alertas de errores automáticas

### 🚀 **Escalabilidad**
- Rate limiting configurable
- Batch processing eficiente
- Optimización de consultas con índices

---

**¡El sistema está listo! Solo necesita las credenciales de SIIGO para activarse completamente.**
