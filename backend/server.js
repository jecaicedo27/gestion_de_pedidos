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
const { execSync } = require('child_process');
const mysql = require('mysql2/promise');

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

// Importar servicios
const siigoUpdateService = require('./services/siigoUpdateService');
const { initializeAutoImport } = require('./initAutoImport');
const autoSyncService = require('./services/autoSyncService');
const StockSyncService = require('./services/stockSyncService');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3002', // Puerto alternativo para desarrollo
      'http://localhost:3001',  // Por si el frontend corre en otro puerto
      'http://localhost:3050',  // Nuevo puerto de frontend
      'http://46.202.93.54'
    ],
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

// Installer helpers
function isInstalled() {
  try {
    // Consider installed if .env exists and a marker file exists
    const envExists = fs.existsSync(path.join(__dirname, '.env'));
    const markerExists = fs.existsSync(path.join(__dirname, '.installed'));
    return envExists && markerExists;
  } catch {
    return false;
  }
}

function generateSecret(length = 48) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let res = '';
  for (let i = 0; i < length; i++) res += chars[Math.floor(Math.random() * chars.length)];
  return res;
}

function generateHexKey64() {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 64; i++) out += hex[Math.floor(Math.random() * hex.length)];
  return out;
}

/**
 * Fallback para crear BD/usuario usando CLI mysql/mariadb (auth_socket root)
 */
function tryMysqlCliCreate(dbName, dbUser, dbPass) {
  if (!dbName || !dbUser) return false;
  try {
    const sql =
      `CREATE DATABASE IF NOT EXISTS \\\\\`${dbName}\\\\\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; ` +
      `CREATE USER IF NOT EXISTS '${dbUser}'@'localhost' IDENTIFIED BY '${dbPass || ''}'; ` +
      `GRANT ALL PRIVILEGES ON \\ \\\`${dbName}\\\\\`.* TO '${dbUser}'@'localhost'; FLUSH PRIVILEGES;`.replace(/\\ \\\`/g, '\\\\`'); // keep backticks escaped
    try {
      execSync(`mysql -u root -e "${sql}"`, { stdio: 'pipe' });
      console.log('✅ CLI mysql (root) ejecutado para crear BD/usuario.');
      return true;
    } catch (_e) {
      execSync(`mariadb -u root -e "${sql}"`, { stdio: 'pipe' });
      console.log('✅ CLI mariadb (root) ejecutado para crear BD/usuario.');
      return true;
    }
  } catch (e) {
    console.warn('⚠️  CLI mysql/mariadb fallback failed:', e.message);
    return false;
  }
}

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
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Configuración de CORS
const corsOptions = {
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3002', // Puerto alternativo para desarrollo
    'http://localhost:3001',  // Por si el frontend corre en otro puerto
    'http://localhost:3050',  // Nuevo puerto de frontend
    'http://46.202.93.54'
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

// Rate limiter general para otras rutas (debe ir al final)
app.use('/api/', generalLimiter);

// Middleware de logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Middleware para parsing de JSON y formularios (necesario para /install)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Installer UI (visual end-to-end)
 * - GET /install: simple form to collect DB and SIIGO settings
 * - POST /install: writes .env, optionally creates DB/user, runs migration, writes .installed
 * - Locked after installation
 */
app.get('/install', (req, res) => {
  if (isInstalled()) {
    return res.status(409).send('✅ Ya instalado. Si necesitas reinstalar, elimina backend/.installed y backend/.env manualmente.');
  }
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const defaultFrontend = `http://${host.split(',')[0]}`;
  res.send(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>Instalación - Gestión de Pedidos</title>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu;max-width:900px;margin:40px auto;padding:0 16px;color:#111}
  h1{margin-bottom:4px} .muted{color:#666}
  form{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px}
  fieldset{border:1px solid #e5e7eb;border-radius:8px;margin:16px 0;padding:12px}
  legend{padding:0 6px;color:#374151}
  label{display:block;margin:10px 0 4px}
  input[type=text],input[type=password],input[type=number]{width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px}
  .row{display:flex;gap:12px} .col{flex:1}
  button{background:#111827;color:#fff;border:0;border-radius:8px;padding:10px 16px;cursor:pointer}
  .help{font-size:12px;color:#6b7280}
</style>
</head>
<body>
<h1>Instalación de Gestión de Pedidos</h1>
<p class="muted">Completa los datos. Este instalador creará el archivo .env, (opcional) la base de datos y dejará todo listo.</p>
<form method="POST" action="/install">
  <fieldset>
    <legend>Servidor</legend>
    <div class="row">
      <div class="col">
        <label>Puerto backend (PORT)</label>
        <input name="port" type="number" value="${PORT}" required />
      </div>
      <div class="col">
        <label>Frontend URL</label>
        <input name="frontend_url" type="text" value="${defaultFrontend}" required />
        <div class="help">Ej: http://IP ó http://dominio</div>
      </div>
    </div>
    <label>JWT Secret</label>
    <input name="jwt_secret" type="text" placeholder="(opcional, se genera si está vacío)" />
  </fieldset>

  <fieldset>
    <legend>Base de Datos</legend>
    <div class="row">
      <div class="col"><label>DB Host</label><input name="db_host" type="text" value="127.0.0.1" required /></div>
      <div class="col"><label>DB Port</label><input name="db_port" type="number" value="3306" required /></div>
    </div>
    <div class="row">
      <div class="col"><label>DB Name</label><input name="db_name" type="text" value="gestion_pedidos_dev" required /></div>
      <div class="col"><label>DB User</label><input name="db_user" type="text" value="gp_user" required /></div>
    </div>
    <label>DB Password</label>
    <input name="db_password" type="password" placeholder="password de gp_user" />
    <div class="help">Si el usuario/base aún no existen, completa Admin User/Pass para que el instalador los cree.</div>
    <div class="row">
      <div class="col"><label>Admin User (opcional)</label><input name="admin_user" type="text" placeholder="root u otro admin"/></div>
      <div class="col"><label>Admin Password (opcional)</label><input name="admin_pass" type="password" placeholder="password admin"/></div>
    </div>
  </fieldset>

  <fieldset>
    <legend>SIIGO (opcional, puedes dejarlo vacío y configurar luego)</legend>
    <label>SIIGO Username</label>
    <input name="siigo_username" type="text" />
    <label>SIIGO Access Key</label>
    <input name="siigo_access_key" type="text" />
    <label>SIIGO Base URL</label>
    <input name="siigo_base_url" type="text" value="https://api.siigo.com" />
  </fieldset>

  <button type="submit">Instalar</button>
</form>
</body></html>`);
});

app.post('/install', async (req, res) => {
  if (isInstalled()) {
    return res.status(409).send('✅ Ya instalado.');
  }
  try {
    const {
      port, frontend_url, jwt_secret,
      db_host, db_port, db_name, db_user, db_password,
      admin_user, admin_pass,
      siigo_username, siigo_access_key, siigo_base_url
    } = req.body || {};

    const resolvedPort = String(port || '') || String(PORT);
    const secret = jwt_secret && String(jwt_secret).trim() ? jwt_secret.trim() : generateSecret(48);
    const encKey = (process.env.CONFIG_ENCRYPTION_KEY && /^[0-9a-fA-F]{64}$/.test(process.env.CONFIG_ENCRYPTION_KEY))
      ? process.env.CONFIG_ENCRYPTION_KEY
      : generateHexKey64();

    // Optionally create DB/user using admin credentials (TCP) o fallback CLI (auth_socket)
    let created = false;
    if (admin_user && admin_pass) {
      try {
        const conn = await mysql.createConnection({
          host: db_host || '127.0.0.1',
          port: Number(db_port || 3306),
          user: admin_user,
          password: admin_pass,
          multipleStatements: true
        });
        await conn.query(`CREATE DATABASE IF NOT EXISTS \`${db_name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        if (db_user) {
          try {
            await conn.query(`CREATE USER IF NOT EXISTS ?@'localhost' IDENTIFIED BY ?`, [db_user, db_password || '']);
          } catch {}
          try {
            await conn.query(`GRANT ALL PRIVILEGES ON \`${db_name}\`.* TO ?@'localhost'`, [db_user]);
            await conn.query(`FLUSH PRIVILEGES`);
          } catch {}
        }
        await conn.end();
        created = true;
        console.log('✅ DB/usuario creados con credenciales admin (TCP).');
      } catch (e) {
        console.warn('⚠️  DB admin TCP failed:', e.message);
      }
      if (!created) {
        created = tryMysqlCliCreate(db_name, db_user, db_password);
      }
    } else {
      // Sin admin: intentar con CLI (root auth_socket)
      created = tryMysqlCliCreate(db_name, db_user, db_password);
    }

    // Write backend/.env
    const envContent =
`# --- Server ---
PORT=${resolvedPort}
NODE_ENV=production

# --- DB ---
DB_HOST=${db_host || '127.0.0.1'}
DB_PORT=${db_port || 3306}
DB_USER=${db_user || ''}
DB_PASSWORD=${db_password || ''}
DB_NAME=${db_name || 'gestion_pedidos_dev'}

# --- JWT ---
JWT_SECRET=${secret}
JWT_EXPIRES_IN=24h
CONFIG_ENCRYPTION_KEY=${encKey}

# --- CORS ---
FRONTEND_URL=${frontend_url || 'http://localhost:3000'}

# --- SIIGO ---
SIIGO_ENABLED=true
SIIGO_API_USERNAME=${siigo_username || ''}
SIIGO_API_ACCESS_KEY=${siigo_access_key || ''}
SIIGO_API_BASE_URL=${siigo_base_url || 'https://api.siigo.com'}
SIIGO_PARTNER_ID=siigo
SIIGO_WEBHOOK_SECRET=secure-webhook-secret

# --- Auto Sync SIIGO ---
SIIGO_AUTO_SYNC=false
SIIGO_SYNC_INTERVAL=5
`;
    fs.writeFileSync(path.join(__dirname, '.env'), envContent, 'utf8');

    // Run portable migration
    let migrationOut = '';
    try {
      migrationOut = execSync('node scripts/fix_enums_portable.js', { cwd: __dirname, stdio: 'pipe' }).toString();
    } catch (e) {
      migrationOut = (e.stdout ? e.stdout.toString() : '') + '\n' + (e.stderr ? e.stderr.toString() : '');
    }

    // Create installed marker
    fs.writeFileSync(path.join(__dirname, '.installed'), new Date().toISOString(), 'utf8');

    // Render result
    res.send(`<!doctype html><html><head><meta charset="utf-8"/><title>Instalación completada</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu;max-width:900px;margin:40px auto;padding:0 16px;color:#111}pre{background:#0f172a;color:#e5e7eb;padding:12px;border-radius:8px;overflow:auto}</style>
</head><body>
  <h1>✅ Instalación completada</h1>
  <p>Se creó backend/.env y se ejecutó la migración. Si el backend corre con PM2, reinicia con:</p>
  <pre>pm2 restart gestion-backend --update-env</pre>
  <p>Health de la API:</p>
  <pre>curl -i http://127.0.0.1/api/health</pre>
  <h3>Salida de migración</h3>
  <pre>${(migrationOut || '').replace(/</g,'<')}</pre>
  <p>Ahora puedes abrir el frontend y autenticarte. Si ves algún 502, verifica Nginx y el puerto configurado (${resolvedPort}).</p>
</body></html>`);
  } catch (e) {
    res.status(500).send(`❌ Error en instalación: ${e.message}`);
  }
});

// Servir archivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/**
 * Ruta raíz y favicon para evitar 404 al abrir http://localhost:3001
 */
app.get('/', (req, res) => {
  if (!isInstalled()) {
    return res.send('Instalador disponible. Abre <a href="/install">/install</a> para configurar.');
  }
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
        message: 'El archivo es demasiado grande (máx 5MB)'
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
    // Probar conexión a la base de datos (omitir en modo instalación)
    const installMode = !isInstalled();
    let dbConnected = false;
    if (!installMode) {
      dbConnected = await testConnection();
    }
    
    if (!installMode && !dbConnected) {
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
      
      // Si está en modo instalación, no iniciar servicios y mostrar instrucción
      if (!dbConnected || !isInstalled()) {
        console.log('🧩 Modo instalación activo. Abre /install para configurar la base de datos y credenciales.');
        return;
      }

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
      
      // Inicializar sistema de sincronización de stock con webhooks (controlado por BD)
      (async () => {
        if (await isSiigoEnabled()) {
          console.log('🔄 Iniciando sistema de sincronización de stock...');
          const stockSyncService = new StockSyncService();
          
          // Intentar iniciar el sistema de stock sync
          setTimeout(async () => {
            try {
              await stockSyncService.startAutoSync();
              console.log('✅ Sistema de sincronización de stock iniciado correctamente');
            } catch (error) {
              console.error('⚠️  Error iniciando sincronización de stock (continuando sin ella):', error.message);
            }
          }, 3000);
        } else {
          console.log('⏸️ SIIGO deshabilitado en BD. Sistema de sincronización de stock no iniciado.');
        }
      })();
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
