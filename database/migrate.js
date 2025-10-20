const mysql = require('../backend/node_modules/mysql2/promise');
const bcrypt = require('../backend/node_modules/bcryptjs');
const fs = require('fs');
const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true
};

const dbName = process.env.DB_NAME || 'gestion_pedidos_dev';

// Función para crear conexión
const createConnection = async () => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexión a MySQL establecida');
    return connection;
  } catch (error) {
    console.error('❌ Error conectando a MySQL:', error.message);
    throw error;
  }
};

// Función para crear base de datos
const createDatabase = async (connection) => {
  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ Base de datos '${dbName}' creada o ya existe`);
    
    await connection.query(`USE \`${dbName}\``);
    console.log(`✅ Usando base de datos '${dbName}'`);
  } catch (error) {
    console.error('❌ Error creando base de datos:', error.message);
    throw error;
  }
};

// Función para crear tablas
const createTables = async (connection) => {
  try {
    console.log('📋 Creando tablas...');

    // Tabla de usuarios
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'facturador', 'cartera', 'logistica', 'mensajero') NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_login TIMESTAMP NULL,
        INDEX idx_username (username),
        INDEX idx_email (email),
        INDEX idx_role (role),
        INDEX idx_active (active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabla users creada');

    // Tabla de pedidos
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        invoice_code VARCHAR(50),
        customer_name VARCHAR(100) NOT NULL,
        customer_phone VARCHAR(20) NOT NULL,
        customer_address TEXT NOT NULL,
        customer_email VARCHAR(100),
        customer_department VARCHAR(100),
        customer_city VARCHAR(100),
        delivery_method ENUM('recoge_bodega', 'envio_nacional', 'domicilio_ciudad') DEFAULT 'domicilio_ciudad',
        payment_method ENUM('efectivo', 'transferencia', 'tarjeta_credito', 'pago_electronico') DEFAULT 'efectivo',
        status ENUM('pendiente', 'confirmado', 'en_preparacion', 'listo', 'enviado', 'entregado', 'cancelado') DEFAULT 'pendiente',
        total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        notes TEXT,
        delivery_date DATE,
        created_by INT NOT NULL,
        assigned_to INT NULL,
        siigo_invoice_id VARCHAR(100),
        siigo_invoice_number VARCHAR(100),
        order_source ENUM('manual', 'siigo_automatic') DEFAULT 'manual',
        siigo_observations TEXT,
        parsing_status ENUM('auto_success', 'needs_review', 'manual_corrected') DEFAULT 'auto_success',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
        FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_order_number (order_number),
        INDEX idx_invoice_code (invoice_code),
        INDEX idx_customer_name (customer_name),
        INDEX idx_customer_phone (customer_phone),
        INDEX idx_status (status),
        INDEX idx_created_by (created_by),
        INDEX idx_assigned_to (assigned_to),
        INDEX idx_created_at (created_at),
        INDEX idx_delivery_date (delivery_date),
        INDEX idx_delivery_method (delivery_method),
        INDEX idx_payment_method (payment_method),
        INDEX idx_siigo_invoice_id (siigo_invoice_id),
        INDEX idx_order_source (order_source),
        INDEX idx_parsing_status (parsing_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabla orders creada');

    // Tabla de items de pedidos
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        price DECIMAL(10,2) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        INDEX idx_order_id (order_id),
        INDEX idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabla order_items creada');

    // Tabla de configuración de empresa
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS company_config (
        id INT PRIMARY KEY DEFAULT 1,
        name VARCHAR(100) NOT NULL DEFAULT 'Mi Empresa',
        logo_url VARCHAR(255) DEFAULT '',
        primary_color VARCHAR(7) DEFAULT '#3B82F6',
        secondary_color VARCHAR(7) DEFAULT '#1E40AF',
        address TEXT,
        phone VARCHAR(20),
        email VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CHECK (id = 1)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabla company_config creada');

    // Tabla de logs de actividad (opcional para auditoría)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        action VARCHAR(50) NOT NULL,
        table_name VARCHAR(50) NOT NULL,
        record_id INT,
        old_values JSON,
        new_values JSON,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_action (action),
        INDEX idx_table_name (table_name),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabla activity_logs creada');

    // Tabla de configuraciones SIIGO
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS siigo_configurations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        config_key VARCHAR(100) UNIQUE NOT NULL,
        config_value TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_config_key (config_key),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabla siigo_configurations creada');

    // Tabla de logs de sincronización SIIGO
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS siigo_sync_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        siigo_invoice_id VARCHAR(100),
        sync_type ENUM('webhook', 'manual') NOT NULL,
        sync_status ENUM('success', 'error', 'pending') DEFAULT 'pending',
        order_id INT NULL,
        error_message TEXT,
        siigo_data JSON,
        processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
        INDEX idx_siigo_invoice_id (siigo_invoice_id),
        INDEX idx_sync_status (sync_status),
        INDEX idx_sync_type (sync_type),
        INDEX idx_processed_at (processed_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabla siigo_sync_log creada');

    // Tabla de notificaciones WhatsApp
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS whatsapp_notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NULL,
        phone_number VARCHAR(20) NOT NULL,
        message_type ENUM('pedido_en_ruta', 'guia_envio', 'pedido_entregado', 'test') NOT NULL,
        message_content TEXT NOT NULL,
        image_url VARCHAR(500),
        wapify_message_id VARCHAR(100),
        status ENUM('pendiente', 'enviado', 'entregado', 'fallido') DEFAULT 'pendiente',
        sent_at TIMESTAMP NULL,
        delivered_at TIMESTAMP NULL,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        INDEX idx_order_id (order_id),
        INDEX idx_phone_number (phone_number),
        INDEX idx_message_type (message_type),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabla whatsapp_notifications creada');

    // Tabla de transportadoras
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS shipping_companies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT true,
        guide_format_pattern VARCHAR(100),
        website_tracking_url VARCHAR(500),
        logo_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_code (code),
        INDEX idx_is_active (is_active),
        INDEX idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabla shipping_companies creada');

    // Tabla de configuraciones de remitente
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sender_configurations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_name VARCHAR(100) NOT NULL,
        company_nit VARCHAR(50) NOT NULL,
        address_line1 VARCHAR(200) NOT NULL,
        city VARCHAR(100) NOT NULL,
        department VARCHAR(100) NOT NULL,
        country VARCHAR(100) DEFAULT 'Colombia',
        phone VARCHAR(20) NOT NULL,
        email VARCHAR(100) NOT NULL,
        is_default BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_is_default (is_default)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabla sender_configurations creada');

    // Tabla de guías de envío manuales
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS manual_shipping_guides (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        shipping_company_id INT NOT NULL,
        guide_number VARCHAR(100) NOT NULL,
        guide_image_url VARCHAR(500) NOT NULL,
        payment_type ENUM('contraentrega', 'contado') NOT NULL,
        package_weight DECIMAL(8,2) NOT NULL,
        package_dimensions VARCHAR(100),
        package_content TEXT NOT NULL,
        declared_value DECIMAL(10,2) NOT NULL,
        shipping_cost DECIMAL(10,2) DEFAULT 0,
        special_observations TEXT,
        sender_info JSON NOT NULL,
        recipient_info JSON NOT NULL,
        tracking_url VARCHAR(500),
        current_status ENUM('generada', 'en_transito', 'entregada', 'devuelta') DEFAULT 'generada',
        created_by_user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (shipping_company_id) REFERENCES shipping_companies(id) ON DELETE RESTRICT,
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
        INDEX idx_order_id (order_id),
        INDEX idx_shipping_company_id (shipping_company_id),
        INDEX idx_guide_number (guide_number),
        INDEX idx_current_status (current_status),
        INDEX idx_created_by_user_id (created_by_user_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabla manual_shipping_guides creada');

    // Agregar columnas a la tabla orders (compatibilidad con MySQL 5.7/MariaDB sin IF NOT EXISTS)
    // 1) Asegurar columna assigned_guide_id
    const [colAssignedGuide] = await connection.execute(
      "SELECT COUNT(*) AS count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'assigned_guide_id'",
      [dbName]
    );
    if (colAssignedGuide[0].count === 0) {
      await connection.execute("ALTER TABLE orders ADD COLUMN assigned_guide_id INT NULL");
      console.log('✅ Columna orders.assigned_guide_id agregada');
    } else {
      console.log('ℹ️  Columna orders.assigned_guide_id ya existe');
    }

    // 2) Asegurar FK a manual_shipping_guides
    const [fkRows] = await connection.execute(
      "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'assigned_guide_id' AND REFERENCED_TABLE_NAME = 'manual_shipping_guides'",
      [dbName]
    );
    if (fkRows.length === 0) {
      await connection.execute("ALTER TABLE orders ADD CONSTRAINT fk_orders_assigned_guide FOREIGN KEY (assigned_guide_id) REFERENCES manual_shipping_guides(id) ON DELETE SET NULL");
      console.log('✅ FK orders.assigned_guide_id -> manual_shipping_guides.id agregada');
    } else {
      console.log('ℹ️  FK de orders.assigned_guide_id ya existe');
    }

    // Nota: no tocamos delivery_method aquí; se mantiene la definición creada previamente
    console.log('✅ Tabla orders validada/actualizada con nuevas relaciones');

    // Crear/actualizar tabla siigo_credentials y seed por defecto
    try {
      const sqlPath = path.join(__dirname, 'create_siigo_credentials.sql');
      if (fs.existsSync(sqlPath)) {
        const siigoSql = fs.readFileSync(sqlPath, 'utf8');
        // Usar query para permitir múltiples sentencias (CREATE + INSERT IGNORE)
        await connection.query(siigoSql);
        console.log('✅ Tabla siigo_credentials creada/verificada y seed ejecutado');
      } else {
        // Fallback inline mínimo si no existe el archivo SQL
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS siigo_credentials (
              id INT AUTO_INCREMENT PRIMARY KEY,
              company_id INT DEFAULT 1,
              siigo_username VARCHAR(255) NOT NULL,
              siigo_access_key TEXT NOT NULL,
              siigo_base_url VARCHAR(255) DEFAULT 'https://api.siigo.com/v1',
              webhook_secret TEXT NULL,
              is_enabled BOOLEAN DEFAULT TRUE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              created_by INT NULL,
              updated_by INT NULL,
              UNIQUE KEY unique_company_siigo (company_id),
              INDEX idx_company_enabled (company_id, is_enabled),
              INDEX idx_created_at (created_at),
              INDEX idx_updated_at (updated_at)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Tabla siigo_credentials creada (fallback inline)');
      }
    } catch (e) {
      console.error('⚠️ Error creando siigo_credentials (continuando):', e.message);
    }

    console.log('✅ Todas las tablas creadas exitosamente');

  } catch (error) {
    console.error('❌ Error creando tablas:', error.message);
    throw error;
  }
};

// Función para insertar datos iniciales
const insertInitialData = async (connection) => {
  try {
    console.log('📋 Insertando datos iniciales...');

    // Verificar si ya existe el usuario admin
    const [existingAdmin] = await connection.execute(
      'SELECT id FROM users WHERE username = ?',
      ['admin']
    );

    if (existingAdmin.length === 0) {
      // Crear usuario admin por defecto
      const adminPassword = await bcrypt.hash('admin123', 10);
      
      await connection.execute(`
        INSERT INTO users (username, email, password, role, full_name, active, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, NOW())
      `, ['admin', 'admin@empresa.com', adminPassword, 'admin', 'Administrador del Sistema', true]);
      
      console.log('✅ Usuario admin creado (username: admin, password: admin123)');
    } else {
      console.log('ℹ️  Usuario admin ya existe');
    }

    // Crear usuarios de ejemplo para cada rol
    const sampleUsers = [
      {
        username: 'facturador1',
        email: 'facturador@empresa.com',
        password: await bcrypt.hash('facturador123', 10),
        role: 'facturador',
        full_name: 'Juan Pérez - Facturador',
        phone: '3001234567'
      },
      {
        username: 'cartera1',
        email: 'cartera@empresa.com',
        password: await bcrypt.hash('cartera123', 10),
        role: 'cartera',
        full_name: 'María García - Cartera',
        phone: '3007654321'
      },
      {
        username: 'logistica1',
        email: 'logistica@empresa.com',
        password: await bcrypt.hash('logistica123', 10),
        role: 'logistica',
        full_name: 'Carlos López - Logística',
        phone: '3009876543'
      },
      {
        username: 'mensajero1',
        email: 'mensajero@empresa.com',
        password: await bcrypt.hash('mensajero123', 10),
        role: 'mensajero',
        full_name: 'Ana Rodríguez - Mensajero',
        phone: '3005432109'
      }
    ];

    for (const user of sampleUsers) {
      const [existing] = await connection.execute(
        'SELECT id FROM users WHERE username = ?',
        [user.username]
      );

      if (existing.length === 0) {
        await connection.execute(`
          INSERT INTO users (username, email, password, role, full_name, phone, active, created_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        `, [user.username, user.email, user.password, user.role, user.full_name, user.phone, true]);
        
        console.log(`✅ Usuario ${user.role} creado (${user.username})`);
      }
    }

    // Insertar configuración inicial de empresa
    const [existingConfig] = await connection.execute('SELECT id FROM company_config WHERE id = 1');
    
    if (existingConfig.length === 0) {
      await connection.execute(`
        INSERT INTO company_config (id, name, logo_url, primary_color, secondary_color, address, phone, email, created_at) 
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        process.env.COMPANY_NAME || 'Mi Empresa',
        process.env.COMPANY_LOGO_URL || '',
        process.env.COMPANY_PRIMARY_COLOR || '#3B82F6',
        process.env.COMPANY_SECONDARY_COLOR || '#1E40AF',
        'Dirección de la empresa',
        '300-123-4567',
        'contacto@empresa.com'
      ]);
      
      console.log('✅ Configuración inicial de empresa creada');
    } else {
      console.log('ℹ️  Configuración de empresa ya existe');
    }

    // Insertar transportadoras colombianas
    const [existingShippingCompanies] = await connection.execute('SELECT COUNT(*) as count FROM shipping_companies');
    
    if (existingShippingCompanies[0].count === 0) {
      const shippingCompanies = [
        ['ENVÍA', 'envia', '^[A-Z0-9]{8,12}$', 'https://www.envia.com/seguimiento/{guide_number}'],
        ['SERVIENTREGA', 'servientrega', '^[A-Z0-9]{8,15}$', 'https://www.servientrega.com/rastro/rastro_remesas.php?codigo={guide_number}'],
        ['INTERRAPIDÍSIMO', 'interrapidisimo', '^\\d{10,12}$', 'https://www.interrapidisimo.com/rastreo?codigo={guide_number}'],
        ['TRANSPRENSA', 'transprensa', '^[A-Z0-9]{6,15}$', ''],
        ['MANESAR Y SERVIR', 'manesar', '^[A-Z0-9]{8,12}$', ''],
        ['TERMINAL', 'terminal', '^[A-Z0-9]{6,12}$', ''],
        ['TE-ENTREGO', 'te_entrego', '^[A-Z0-9]{8,15}$', 'https://www.te-entrego.com/rastreo/{guide_number}'],
        ['SAFERBO', 'saferbo', '^[A-Z0-9]{8,12}$', ''],
        ['COOTMOTOR', 'cootmotor', '^\\d{8,12}$', ''],
        ['J.E. S.A.S', 'je_sas', '^[A-Z0-9]{6,12}$', ''],
        ['ENVÍA-ENTREGA', 'envia_entrega', '^[A-Z0-9]{8,12}$', 'https://www.envia.com/seguimiento/{guide_number}'],
        ['COOTRANSSOL', 'cootranssol', '^[A-Z0-9]{8,12}$', ''],
        ['CARIBE CARGO', 'caribe_cargo', '^[A-Z0-9]{8,15}$', ''],
        ['COONORTE', 'coonorte', '^[A-Z0-9]{8,12}$', ''],
        ['SOTRASANVICENTE', 'sotrasanvicente', '^[A-Z0-9]{8,12}$', ''],
        ['COORDINADORA', 'coordinadora', '^\\d{10,15}$', 'https://www.coordinadora.com/portafolio-de-servicios/seguimiento-de-envios/?codigo={guide_number}'],
        ['EXPRESOS BRASILIA', 'expresos_brasilia', '^[A-Z0-9]{8,12}$', ''],
        ['BOLIVARIANO', 'bolivariano', '^[A-Z0-9]{8,15}$', 'https://www.expresobolivariano.com/rastreo/{guide_number}'],
        ['SOTRAPEÑOL', 'sotrapenol', '^[A-Z0-9]{8,12}$', ''],
        ['COPETRANS', 'copetrans', '^[A-Z0-9]{8,12}$', 'https://www.copetran.com.co/rastreo/{guide_number}'],
        ['SOTRARETIRO', 'sotraretiro', '^[A-Z0-9]{8,12}$', ''],
        ['FLOTA OCCIDENTAL', 'flota_occidental', '^[A-Z0-9]{8,12}$', ''],
        ['LIPSA', 'lipsa', '^[A-Z0-9]{8,12}$', ''],
        ['SATENA', 'satena', '^[A-Z0-9]{8,12}$', 'https://www.satena.com/rastreo/{guide_number}'],
        ['TRANSPORTADORA J.F', 'transportadora_jf', '^[A-Z0-9]{8,12}$', ''],
        ['Z-EXPRESS', 'z_express', '^[A-Z0-9]{8,12}$', ''],
        ['TRANSEGOVIA', 'transegovia', '^[A-Z0-9]{8,12}$', '']
      ];

      for (const [name, code, pattern, trackingUrl] of shippingCompanies) {
        await connection.execute(`
          INSERT INTO shipping_companies (name, code, guide_format_pattern, website_tracking_url, is_active, created_at) 
          VALUES (?, ?, ?, ?, true, NOW())
        `, [name, code, pattern, trackingUrl]);
      }
      
      console.log('✅ 27 transportadoras colombianas creadas');
    } else {
      console.log('ℹ️  Transportadoras ya existen');
    }

    // Insertar configuración de remitente (PERLAS EXPLOSIVAS)
    const [existingSender] = await connection.execute('SELECT COUNT(*) as count FROM sender_configurations');
    
    if (existingSender[0].count === 0) {
      await connection.execute(`
        INSERT INTO sender_configurations (company_name, company_nit, address_line1, city, department, phone, email, is_default, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, true, NOW())
      `, [
        'PERLAS EXPLOSIVAS COLOMBIA S.A.S',
        '901745588',
        'CALLE 50 # 31-48 BUENOS AIRES',
        'Medellín',
        'Antioquia',
        '315 0006559',
        'COMERCIAL@PERLAS-EXPLOSIVAS.COM'
      ]);
      
      console.log('✅ Configuración de remitente PERLAS EXPLOSIVAS creada');
    } else {
      console.log('ℹ️  Configuración de remitente ya existe');
    }

    console.log('✅ Datos iniciales insertados exitosamente');

  } catch (error) {
    console.error('❌ Error insertando datos iniciales:', error.message);
    throw error;
  }
};

// Función principal de migración
const runMigration = async () => {
  let connection;
  
  try {
    console.log('🚀 Iniciando migración de base de datos...\n');
    
    connection = await createConnection();
    await createDatabase(connection);
    await createTables(connection);
    await insertInitialData(connection);
    
    console.log('\n✅ Migración completada exitosamente!');
    console.log('\n📋 Usuarios creados:');
    console.log('  👤 admin / admin123 (Administrador)');
    console.log('  👤 facturador1 / facturador123 (Facturador)');
    console.log('  👤 cartera1 / cartera123 (Cartera)');
    console.log('  👤 logistica1 / logistica123 (Logística)');
    console.log('  👤 mensajero1 / mensajero123 (Mensajero)');
    console.log('\n🎯 Base de datos lista para usar!');
    
  } catch (error) {
    console.error('\n❌ Error en la migración:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
};

// Ejecutar migración si se llama directamente
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
