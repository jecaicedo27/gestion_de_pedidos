const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');

// Configurar dotenv según el entorno
const envFile = process.env.NODE_ENV === 'development' ? '.env.development' : '.env';
require('dotenv').config({ path: path.join(__dirname, envFile) });

const { testConnection, pool } = require('./config/database');

// Importar rutas
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const orderRoutes = require('./routes/orders');
const productRoutes = require('./routes/products');
const siigoRoutes = require('./routes/siigo');
const whatsappRoutes = require('./routes/whatsapp');
const shippingRoutes = require('./routes/shipping');
const logisticsRoutes = require('./routes/logistics');
const walletRoutes = require('./routes/wallet');
const carteraRoutes = require('./routes/cartera');
const customerCreditRoutes = require('./routes/customerCredit');
const packagingRoutes = require('./routes/packaging');
const packagingProgressRoutes = require('./routes/packagingProgress');
const PackagingController = require('./controllers/packagingController');
const MessengerController = require('./controllers/messengerController');
const deliveryMethodsRoutes = require('./routes/deliveryMethods');
const adminRoutes = require('./routes/admin');
const companyConfigRoutes = require('./routes/companyConfig');
const messengerRoutes = require('./routes/messenger');
const quotationsRoutes = require('./routes/quotations');
const customersRoutes = require('./routes/customers');
const configRoutes = require('./routes/config');
const inventoryRoutes = require('./routes/inventory');
const webhooksRoutes = require('./routes/webhooks');
const siigoCategoriesRoutes = require('./routes/siigo-categories');
const analyticsRoutes = require('./routes/analytics');
const heatmapRoutes = require('./routes/heatmap');
const postventaRoutes = require('./routes/postventa');
const monitorRoutes = require('./routes/monitor');
const whapifyRoutes = require('./routes/whapify');

// Importar servicios
const siigoUpdateService = require('./services/siigoUpdateService');
const { initializeAutoImport } = require('./initAutoImport');
const autoSyncService = require('./services/autoSyncService');
const StockSyncService = require('./services/stockSyncService');
const stockSyncManager = require('./services/stockSyncManager');
const PackagingLock = require('./services/packagingLockService');
const stockRealtimeBroadcaster = require('./services/stockRealtimeBroadcaster');
const stockConsistencyService = require('./services/stockConsistencyService');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
// Configuración Socket.IO con CORS flexible y path explícito para despliegue detrás de proxy
const io = new Server(server, {
  path: '/socket.io',
  cors: {
    // Permitir same-origin (sin cabecera Origin) y orígenes HTTP/HTTPS (detrás de Nginx/Apache)
    origin: (origin, callback) => callback(null, true),
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3001;

// Configurar WebSocket para notificaciones en tiempo real
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado:', socket.id);

  socket.on('join-siigo-updates', () => {
    socket.join('siigo-updates');
    console.log('📡 Cliente suscrito a actualizaciones SIIGO:', socket.id);
  });

  socket.on('join-orders-updates', () => {
    socket.join('orders-updates');
    console.log('📡 Cliente suscrito a actualizaciones de pedidos:', socket.id);
  });

  socket.on('join-packaging-updates', () => {
    socket.join('packaging-updates');
    console.log('📡 Cliente suscrito a actualizaciones de empaque:', socket.id);
  });

  socket.on('order-created', (data) => {
    console.log('📡 Retransmitiendo evento order-created:', data);
    // Retransmitir a todas las páginas de pedidos
    socket.to('orders-updates').emit('order-created', data);
    socket.to('siigo-updates').emit('order-created', data);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Cliente desconectado:', socket.id);
  });
});

// Hacer io disponible globalmente para otros módulos
global.io = io;

// Crear directorio de uploads si no existe
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware de seguridad
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Configuración de CORS
const corsOptions = {
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3002', // Puerto alternativo para desarrollo
    'http://localhost:3001',  // Por si el frontend corre en otro puerto
    'http://localhost:3050',  // Nuevo puerto de frontend
    'https://gestionperlas.app',
    'https://www.gestionperlas.app'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Importar los rate limiters configurados
const { generalLimiter, authLimiter, siigoLimiter, queryLimiter } = require('./middleware/rateLimiter');

// Rate limiter para rutas públicas (muy permisivo)
const publicLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 200, // 200 peticiones por minuto
  message: {
    success: false,
    message: 'Demasiadas solicitudes, intenta de nuevo en un momento.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Aplicar rate limiters específicos por ruta
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/verify', publicLimiter);
app.use('/api/auth/profile', publicLimiter);
app.use('/api/config', publicLimiter);
app.use('/api/company-config/public', publicLimiter);
app.use('/api/siigo/', siigoLimiter);
app.use('/api/orders', queryLimiter);
app.use('/api/users', queryLimiter);

/**
 * Rate limiter general para otras rutas (debe ir al final).
 * EXCEPCIÓN: NO aplicar rate limit al endpoint de webhooks /api/webhooks/receive
 * para evitar bloqueos o 429 de SIIGO y garantizar entrega en tiempo real.
 */
app.use((req, res, next) => {
  try {
    const url = req.originalUrl || req.url || '';
    if (url.startsWith('/api/webhooks/receive')) {
      return next();
    }
  } catch { }
  return generalLimiter(req, res, next);
});

// Middleware de logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Middleware para parsing de JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/**
 * Ruta raíz y favicon para evitar 404 al abrir http://localhost:3001
 */
app.get('/', (req, res) => {
  res.send('API de Gestión de Pedidos operando. Visita /api/health para estado.');
});
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/siigo', siigoRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/logistics', logisticsRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/cartera', carteraRoutes);
try {
  console.log('🧭 Cartera router mounted. Stack:',
    Array.isArray(carteraRoutes.stack)
      ? carteraRoutes.stack
        .map(l => l.route && `${Object.keys(l.route.methods)[0].toUpperCase()} ${l.route.path}`)
        .filter(Boolean)
      : 'no stack'
  );
} catch (e) {
  console.log('🧭 Error introspecting cartera router:', e.message);
}
app.use('/api/customer-credit', customerCreditRoutes);
app.use('/api/packaging', packagingRoutes);
app.use('/api/packaging-progress', packagingProgressRoutes);
// Alias directo para subida de evidencia (backup en caso de que el router falle)
app.post('/api/packaging/evidence/:orderId',
  MessengerController.upload.array('photos', 10),
  PackagingController.uploadPackagingEvidence
);
app.use('/api/delivery-methods', deliveryMethodsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/company-config', companyConfigRoutes);
app.use('/api/system-config', require('./routes/systemConfig'));
app.use('/api/siigo-credentials', require('./routes/siigoCredentials'));
app.use('/api/api-config', require('./routes/apiConfig'));
app.use('/api/siigo-auto-import', require('./routes/siigoAutoImport'));
app.use('/api/carriers', require('./routes/carriers'));
app.use('/api/messenger', messengerRoutes);
app.use('/api/quotations', quotationsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/config', configRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/siigo-categories', siigoCategoriesRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/heatmap', heatmapRoutes);
app.use('/api/postventa', postventaRoutes);
app.use('/api/monitor', monitorRoutes);
app.use('/api/whapify', whapifyRoutes);

// Ruta de health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Servidor funcionando correctamente',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Ruta para información del servidor
app.get('/api/info', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Sistema de Gestión de Pedidos',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    }
  });
});

// Ruta de debug para listar rutas montadas (solo en desarrollo)
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/_debug_routes', (req, res) => {
    const routes = [];
    const walk = (stack, prefix = '') => {
      stack.forEach((layer) => {
        if (layer.route && layer.route.path) {
          const methods = Object.keys(layer.route.methods || {})
            .map(m => m.toUpperCase());
          routes.push({ path: prefix + layer.route.path, methods });
        } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
          // Extraer mejor-esfuerzo el prefijo montado desde la regexp
          let base = '';
          if (layer.regexp) {
            const re = layer.regexp.toString();
            // Busca patrón /^\/api\/algo\/?/i
            const m = re.match(/^\/\^\\\/([^\\]+)(?:\\\/([^\\]+))?/);
            if (m) {
              base = '/' + m.slice(1).filter(Boolean).join('/');
            }
          }
          walk(layer.handle.stack, base);
        }
      });
    };
    walk(app._router.stack);
    res.json({ ok: true, routes });
  });
}

// Middleware para rutas no encontradas
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

// Middleware de errores de multer (debe ir DESPUÉS de montar rutas)
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'El archivo es demasiado grande (máx 15MB)'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Error de subida: ${error.message || 'archivo inválido'}`
    });
  }
  return next(error);
});

// Middleware global de manejo de errores
app.use((error, req, res, next) => {
  console.error('Error no manejado:', error);

  // Error de validación de Joi
  if (error.isJoi) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      errors: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  // Error de base de datos
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(400).json({
      success: false,
      message: 'Ya existe un registro con estos datos'
    });
  }

  if (error.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      success: false,
      message: 'Referencia inválida en los datos'
    });
  }

  // Error genérico
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'development'
      ? error.message
      : 'Error interno del servidor'
  });
});

// Función para iniciar el servidor
async function isSiigoEnabled() {
  try {
    const [rows] = await pool.execute(
      'SELECT is_enabled FROM siigo_credentials WHERE company_id = ? ORDER BY updated_at DESC, created_at DESC LIMIT 1',
      [1]
    );
    return rows.length > 0 && !!rows[0].is_enabled;
  } catch (e) {
    console.warn('⚠️ No se pudo leer is_enabled desde BD, usando .env como fallback:', e.message);
    return process.env.SIIGO_ENABLED === 'true';
  }
}

const startServer = async () => {
  try {
    // Probar conexión a la base de datos
    const dbConnected = await testConnection();

    if (!dbConnected) {
      console.error('❌ No se pudo conectar a la base de datos');
      console.log('💡 Asegúrate de que MySQL esté ejecutándose y la configuración sea correcta');
      process.exit(1);
    }

    // Iniciar servidor con WebSocket
    server.listen(PORT, () => {
      console.log('\n🚀 Servidor iniciado exitosamente');
      console.log(`📍 Puerto: ${PORT}`);
      console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 URL: http://localhost:${PORT}`);
      console.log(`📊 API Health: http://localhost:${PORT}/api/health`);
      console.log(`🔌 WebSocket: Habilitado para notificaciones en tiempo real`);
      console.log(`📁 Uploads: ${uploadsDir}`);

      if (process.env.NODE_ENV === 'development') {
        console.log('\n📋 Rutas disponibles:');
        console.log('  POST /api/auth/login');
        console.log('  GET  /api/auth/profile');
        console.log('  GET  /api/users');
        console.log('  GET  /api/orders');
        console.log('  GET  /api/company-config/public');
        console.log('  GET  /api/health');
      }

      console.log('\n✅ Sistema listo para recibir peticiones\n');

      // Iniciar servicio de actualización automática de facturas SIIGO (controlado por BD)
      (async () => {
        if (await isSiigoEnabled()) {
          console.log('🔄 Iniciando servicio de actualización automática de facturas SIIGO...');
          siigoUpdateService.start();
        } else {
          console.log('⏸️ SIIGO deshabilitado en BD. Servicio de actualización automática no iniciado.');
        }
      })();

      // Inicializar sistema de importación automática
      initializeAutoImport();

      // Inicializar sistema de sincronización automática de productos
      autoSyncService.init();

      // Broadcaster realtime basado en DB: emite stock_updated ante cualquier cambio (anulación, ingreso, ajustes, scripts)
      try {
        const started = stockRealtimeBroadcaster.start(pool, io);
        console.log('🛰️ Broadcaster realtime stock iniciado:', started);
      } catch (e) {
        console.error('⚠️ Error iniciando StockRealtimeBroadcaster:', e?.message || e);
      }

      // Inicializar sistema de sincronización de stock con webhooks (controlado por BD)
      (async () => {
        if (await isSiigoEnabled()) {
          console.log('🔄 Iniciando sistema de sincronización de stock (singleton manager)...');
          setTimeout(async () => {
            try {
              await stockSyncManager.start();
              console.log('✅ Sistema de sincronización de stock iniciado correctamente');
            } catch (error) {
              console.error('⚠️  Error iniciando sincronización de stock (continuando sin ella):', error.message);
            }
          }, 3000);
        } else {
          console.log('⏸️ SIIGO deshabilitado en BD. Sistema de sincronión de stock no iniciado.');
        }
      })();

      // Iniciar servicio global de reconciliación de stock con SIIGO
      try {
        setTimeout(async () => {
          try {
            const res = await stockConsistencyService.start();
            console.log('✅ StockConsistencyService iniciado:', res);
          } catch (e) {
            console.error('⚠️ Error iniciando StockConsistencyService:', e?.message || e);
          }
        }, 5000);
      } catch (e) {
        console.error('⚠️ Error programando inicio de StockConsistencyService:', e?.message || e);
      }

      // Monitor de expiración de locks de empaque (cada 60s)
      setInterval(async () => {
        try {
          const result = await PackagingLock.expireStaleLocks('paused');
          if ((result?.released || 0) > 0) {
            console.log(`⏰ Locks de empaque expirados y liberados: ${result.released}`);
          }
        } catch (e) {
          console.error('⚠️ Error expirando locks de empaque:', e?.message || e);
        }
      }, 60 * 1000);
    });

  } catch (error) {
    console.error('❌ Error iniciando el servidor:', error);
    process.exit(1);
  }
};

// Manejo de señales del sistema
process.on('SIGTERM', () => {
  console.log('\n🛑 Recibida señal SIGTERM, cerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Recibida señal SIGINT, cerrando servidor...');
  process.exit(0);
});

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Iniciar servidor
startServer();

module.exports = app;
