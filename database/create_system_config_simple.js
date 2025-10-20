const mysql = require('../backend/node_modules/mysql2/promise');
require('../backend/node_modules/dotenv').config({ path: '../backend/.env' });

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestion_pedidos_dev'
};

async function createSystemConfig() {
  let connection;
  
  try {
    console.log('🗄️ Creando tabla system_config...');
    
    connection = await mysql.createConnection(dbConfig);
    
    // Crear tabla system_config
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS system_config (
        id INT PRIMARY KEY AUTO_INCREMENT,
        config_key VARCHAR(100) NOT NULL UNIQUE,
        config_value TEXT NOT NULL,
        description TEXT,
        data_type ENUM('string', 'number', 'date', 'boolean', 'json') DEFAULT 'string',
        created_by INT,
        updated_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
        
        INDEX idx_config_key (config_key),
        INDEX idx_data_type (data_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✅ Tabla system_config creada');
    
    // Insertar configuraciones iniciales
    const configs = [
      {
        key: 'siigo_start_date',
        value: '2025-01-01',
        description: 'Fecha de inicio para la importación de facturas SIIGO. Solo se importarán facturas creadas desde esta fecha en adelante.',
        type: 'date'
      },
      {
        key: 'siigo_start_date_enabled',
        value: 'true',
        description: 'Determina si se debe aplicar el filtro de fecha de inicio para la importación de facturas SIIGO.',
        type: 'boolean'
      },
      {
        key: 'siigo_historical_warning',
        value: 'true',
        description: 'Determina si se debe mostrar una advertencia sobre facturas históricas anteriores a la fecha de inicio.',
        type: 'boolean'
      }
    ];
    
    for (const config of configs) {
      await connection.execute(`
        INSERT INTO system_config (
          config_key, 
          config_value, 
          description, 
          data_type,
          created_by
        ) VALUES (?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE 
          description = VALUES(description),
          data_type = VALUES(data_type),
          updated_at = CURRENT_TIMESTAMP
      `, [config.key, config.value, config.description, config.type]);
      
      console.log(`✅ Configuración ${config.key} insertada`);
    }
    
    // Verificar configuraciones creadas
    const [rows] = await connection.execute(`
      SELECT config_key, config_value, description, data_type 
      FROM system_config 
      WHERE config_key LIKE 'siigo_%'
      ORDER BY config_key
    `);
    
    console.log('\n📋 Configuraciones del sistema SIIGO:');
    rows.forEach(config => {
      console.log(`  • ${config.config_key}: ${config.config_value} (${config.data_type})`);
    });
    
    console.log('\n✅ Tabla system_config creada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  createSystemConfig()
    .then(() => {
      console.log('\n🎉 Migración completada!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Error en migración:', error);
      process.exit(1);
    });
}

module.exports = createSystemConfig;
