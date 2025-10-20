# 📊 DIAGRAMA DE FLUJO - SISTEMA DE GESTIÓN DE PEDIDOS

## 🔗 **INTEGRACIÓN SIIGO - PUNTO DE ENTRADA**

```
┌─────────────────────────────────────────────────────────────────┐
│                    🏢 SISTEMA SIIGO                              │
│  • Facturas de venta                                             │
│  • Datos de clientes                                             │
│  • Productos e items                                             │
│  • Observaciones de entrega                                      │
└─────────────────────┬───────────────────────────────────────────┘
                      │ API Webhook/Importación
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│               📥 IMPORTACIÓN AUTOMÁTICA                          │
│  • Extrae datos de cliente (nombre, teléfono, dirección)         │
│  • Procesa items del pedido con precios                          │
│  • Captura observaciones especiales                              │
│  • Estado inicial: "pendiente_por_facturacion"                   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
```

## 👥 **ROLES Y ACCESOS DEL SISTEMA**

```
┌─────────────────────────────────────────────────────────────────┐
│                        🏠 DASHBOARD PRINCIPAL                    │
└─────────────────────┬───────────────────────────────────────────┘
                      │
          ┌───────────┼───────────┬───────────┬───────────┐
          │           │           │           │           │
          ▼           ▼           ▼           ▼           ▼
    ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
    │ 👑 ADMIN │ │📋 FACT. │ │💰 CART. │ │📦 LOG.  │ │🚚 MENS. │
    │         │ │         │ │         │ │         │ │         │
    │• Todos  │ │• Pedidos│ │• Validar│ │• Envíos │ │• Guías  │
    │  los    │ │  pendien│ │  pagos  │ │• Empaque│ │• Entrega│
    │  módulos│ │  tes    │ │• Transfer│ │• Logíst.│ │• Estado │
    │• Config │ │• Procesar│ │• Efectivo│ │         │         │
    │• Usuarios│ │  auto   │ │         │ │         │ │         │
    └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
```

## 🔄 **FLUJO PRINCIPAL DE PROCESAMIENTO**

### **ETAPA 1: FACTURACIÓN Y PROCESAMIENTO INICIAL**

```
📋 FACTURADOR
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│  📝 REVISAR PEDIDO (OrderReviewModal)                            │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ ✅ Información verificada:                                  │ │
│  │  • Cliente y datos de contacto                             │ │
│  │  • Items y cantidades                                      │ │
│  │  • Total del pedido                                        │ │
│  │  • Observaciones de SIIGO                                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  🔧 CONFIGURAR:                                                 │
│  • Método de pago (efectivo, transferencia, crédito, etc.)     │
│  • Método de envío (domicilio, nacional, recoge bodega)        │
│  • Fecha de envío                                              │
│  • Notas adicionales                                           │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│           🤖 PROCESAMIENTO AUTOMÁTICO (REGLAS)                   │
│                                                                 │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│  │   💵 EFECTIVO       │    │   🏦 OTROS MÉTODOS             │ │
│  │                     │    │                                 │ │
│  │   ▼                 │    │   ▼                             │ │
│  │ 📦 DIRECTO A        │    │ 💰 PRIMERO A                    │ │
│  │    LOGÍSTICA        │    │    CARTERA                      │ │
│  │                     │    │                                 │ │
│  │ Estado:             │    │ Estado:                         │ │
│  │ "en_logistica"      │    │ "en_cartera"                    │ │
│  └─────────────────────┘    └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### **ETAPA 2: VALIDACIÓN DE CARTERA**

```
💰 CARTERA (Solo para pagos no-efectivo)
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│  💳 VALIDAR PAGO (WalletValidationModal)                         │
│                                                                 │
│  🔍 VERIFICACIONES SEGÚN MÉTODO:                                │
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │  🏦 TRANSFERENCIA   │  │  💳 PAGO ELECTRÓNICO           │   │
│  │                     │  │                                 │   │
│  │  ✅ Validar:        │  │  ✅ Validar:                   │   │
│  │  • Monto exacto     │  │  • Plataforma (MercadoPago,    │   │
│  │  • Destino dinero   │  │    Bold, etc.)                 │   │
│  │    (Bancolombia/    │  │  • Monto recibido              │   │
│  │     MercadoPago)    │  │  • Comprobante                 │   │
│  │  • Comprobante      │  │                                 │   │
│  │  • Referencia       │  │                                 │   │
│  └─────────────────────┘  └─────────────────────────────────┘   │
│                                                                 │
│                           ▼                                     │
│                   ✅ PAGO VALIDADO                               │
│                     Estado: "en_logistica"                     │
└─────────────────────────────────────────────────────────────────┘
```

### **ETAPA 3: LOGÍSTICA Y EMPAQUE**

```
📦 LOGÍSTICA (empaque: usuario "empaque", rol "logistica")
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│  🚛 PROCESAR ENVÍO (LogisticsModal)                              │
│                                                                 │
│  📋 INFORMACIÓN PRECARGADA:                                     │
│  • Método de envío (seleccionado por facturador)               │
│  • Datos del destinatario extraídos de SIIGO                   │
│  • Observaciones especiales de entrega                         │
│                                                                 │
│  🔧 CONFIGURAR ENVÍO:                                           │
│  • Transportadora (Servientrega, Coordinadora, etc.)           │
│  • Número de guía                                              │
│  • Notas adicionales del empaque                               │
│                                                                 │
│  📄 GENERAR:                                                    │
│  • Guía de envío (PDF descargable)                             │
│  • Datos completos remitente/destinatario                      │
│                                                                 │
│                           ▼                                     │
│                   📦 PROCESADO PARA ENVÍO                       │
│                     Estado: "en_empaque"                       │
└─────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    📦 SISTEMA DE EMPAQUE                         │
│  • Escaneo de códigos de barras                                │
│  • Verificación de items vs. guía                              │
│  • Control de calidad                                          │
│  • Estado: "empacado"                                          │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
```

### **ETAPA 4: ENTREGA Y MENSAJERÍA**

```
🚚 MENSAJERO
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│                   🚛 GESTIÓN DE ENTREGAS                         │
│                                                                 │
│  📋 FUNCIONALIDADES:                                            │
│  • Guías asignadas                                             │
│  • Rutas optimizadas                                           │
│  • Registro de entrega                                         │
│  • Estados: "en_ruta" → "entregado"                            │
│  • Notificaciones WhatsApp                                     │
└─────────────────────────────────────────────────────────────────┘
```

## 📊 **ESTADOS DEL PEDIDO - CICLO COMPLETO**

```
┌─────────────────────────────────────────────────────────────────┐
│                    🔄 FLUJO DE ESTADOS                           │
│                                                                 │
│  📥 pendiente_por_facturacion                                   │
│              │                                                  │
│              ▼                                                  │
│  📋 procesando (Facturador revisando)                           │
│              │                                                  │
│              ▼                                                  │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│  │  💵 EFECTIVO        │    │  🏦 OTROS PAGOS                │ │
│  │       │             │    │       │                         │ │
│  │       ▼             │    │       ▼                         │ │
│  │  📦 en_logistica    │    │  💰 en_cartera                  │ │
│  │       │             │    │       │                         │ │
│  │       │             │    │       ▼                         │ │
│  │       │             │    │  ✅ validado                    │ │
│  │       │             │    │       │                         │ │
│  │       │             │    │       ▼                         │ │
│  │       │             │    │  📦 en_logistica                │ │
│  └───────┼─────────────┘    └───────┼─────────────────────────┘ │
│           │                         │                           │
│           └─────────────┬───────────┘                           │
│                         ▼                                       │
│                   📦 en_empaque                                 │
│                         │                                       │
│                         ▼                                       │
│                   📦 empacado                                   │
│                         │                                       │
│                         ▼                                       │
│                   🚛 en_ruta                                    │
│                         │                                       │
│                         ▼                                       │
│                   ✅ entregado                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 **INTEGRACIONES Y SERVICIOS EXTERNOS**

```
┌─────────────────────────────────────────────────────────────────┐
│                    🌐 INTEGRACIONES ACTIVAS                      │
│                                                                 │
│  🏢 SIIGO                    📱 WHATSAPP                        │
│  • Facturas automáticas     • Notificaciones                   │
│  • Datos de clientes        • Estados de pedido                │
│  • Items y precios          • Confirmaciones                   │
│  • Observaciones            • Alertas                          │
│                                                                 │
│  💳 MEDIOS DE PAGO           📊 REPORTES                        │
│  • MercadoPago               • Dashboard en tiempo real        │
│  • Bold                      • Métricas por usuario            │
│  • Bancolombia               • Estados de pedidos              │
│  • Transferencias            • Rendimiento                     │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 **VALIDACIONES Y REGLAS DE NEGOCIO**

```
┌─────────────────────────────────────────────────────────────────┐
│                   ⚡ REGLAS AUTOMÁTICAS                          │
│                                                                 │
│  🔒 VALIDACIONES DE TRANSFERENCIA:                              │
│  • Monto debe coincidir exactamente                            │
│  • Destino: Solo Bancolombia o MercadoPago                     │
│  • Comprobante obligatorio                                     │
│  • Referencia requerida                                        │
│                                                                 │
│  📋 FLUJO AUTOMÁTICO ADMIN/FACTURADOR:                          │
│  • Efectivo → Logística directamente                           │
│  • Otros pagos → Cartera primero                               │
│                                                                 │
│  📦 PRECARGA LOGÍSTICA:                                         │
│  • Método de envío viene del facturador                        │
│  • Datos de destinatario extraídos de SIIGO                    │
│  • Observaciones especiales incluidas                          │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 **TECNOLOGÍAS Y ARQUITECTURA**

```
┌─────────────────────────────────────────────────────────────────┐
│                     🏗️ STACK TECNOLÓGICO                        │
│                                                                 │
│  FRONTEND:               BACKEND:               BASE DE DATOS:  │
│  • React.js             • Node.js               • MySQL        │
│  • Tailwind CSS         • Express.js            • Migraciones  │
│  • Lucide Icons         • JWT Auth              • Relaciones   │
│  • React Hot Toast      • Middleware            • Índices      │
│                         • API REST                              │
│                                                                 │
│  SERVICIOS:              SEGURIDAD:             DEPLOY:         │
│  • SIIGO API            • Autenticación         • Puerto 3001  │
│  • WhatsApp API         • Roles y permisos      • Puerto 3000  │
│  • PDF Generation       • Rate Limiting         • Variables    │
│  • File Upload          • Validaciones          • de entorno   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 **RESUMEN DEL FLUJO OPTIMIZADO**

1. **🏢 SIIGO** → Importa factura como "pendiente_por_facturacion"
2. **📋 FACTURADOR** → Revisa, configura método envío/pago, procesa automáticamente
3. **⚡ SISTEMA** → Aplica reglas: efectivo→logística, otros→cartera
4. **💰 CARTERA** → Valida pagos con opciones simplificadas (Bancolombia/MercadoPago)
5. **📦 LOGÍSTICA** → Recibe pedidos con método de envío **preseleccionado**
6. **🚚 MENSAJERO** → Gestiona entregas y actualizaciones de estado

**¡Sistema completamente funcional y optimizado!** 🎉
