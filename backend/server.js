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

const { testConnection } = require('./config/database');

// Importar rutas
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const orderRoutes = require('./routes/orders');
const siigoRoutes = require('./routes/siigo');
const whatsappRoutes = require('./routes/whatsapp');
const shippingRoutes = require('./routes/shipping');
const logisticsRoutes = require('./routes/logistics');
const walletRoutes = require('./routes/wallet');
const customerCreditRoutes = require('./routes/customerCredit');
const packagingRoutes = require('./routes/packaging');
const deliveryMethodsRoutes = require('./routes/deliveryMethods');
const adminRoutes = require('./routes/admin');
const companyConfigRoutes = require('./routes/companyConfig');

// Importar servicios
const siigoUpdateService = require('./services/siigoUpdateService');
const { initializeAutoImport } = require('./initAutoImport');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3002', // Puerto alternativo para desarrollo
      'http://localhost:3001'  // Por si el frontend corre en otro puerto
    ],
    methods: ['GET', 'POST']
  }
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
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Configuración de CORS
const corsOptions = {
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3002', // Puerto alternativo para desarrollo
    'http://localhost:3001'  // Por si el frontend corre en otro puerto
  ],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting - Configuración más flexible
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500, // Aumentado el límite general
  message: {
    success: false,
    message: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Excluir rutas críticas del frontend
  skip: (req) => {
    const criticalRoutes = [
      '/api/auth/verify',
      '/api/auth/profile', 
      '/api/config/public',
      '/api/company-config/public',
      '/api/health',
      '/api/info'
    ];
    return criticalRoutes.some(route => req.path === route);
  }
});

// Rate limiter específico para SIIGO (más restrictivo)
const siigoLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 50, // Límite más bajo para SIIGO
  message: {
    success: false,
    message: 'Demasiadas solicitudes a SIIGO, intenta de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Aplicar rate limiters
app.use('/api/', generalLimiter);
app.use('/api/siigo/', siigoLimiter);

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

// Middleware para manejo de errores de multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'El archivo es demasiado grande'
      });
    }
  }
  next(error);
});

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/siigo', siigoRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/logistics', logisticsRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/customer-credit', customerCreditRoutes);
app.use('/api/packaging', packagingRoutes);
app.use('/api/delivery-methods', deliveryMethodsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/company-config', companyConfigRoutes);
app.use('/api/system-config', require('./routes/systemConfig'));
app.use('/api/siigo-credentials', require('./routes/siigoCredentials'));
app.use('/api/api-config', require('./routes/apiConfig'));
app.use('/api/siigo-auto-import', require('./routes/siigoAutoImport'));

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

// Middleware para rutas no encontradas
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
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
      
      // Iniciar servicio de actualización automática de facturas SIIGO
      if (process.env.SIIGO_ENABLED === 'true') {
        console.log('🔄 Iniciando servicio de actualización automática de facturas SIIGO...');
        siigoUpdateService.start();
      }
      
      // Inicializar sistema de importación automática
      initializeAutoImport();
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
