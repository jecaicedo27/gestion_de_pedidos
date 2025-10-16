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

const addSoftDeleteColumn = async () => {
  let connection;
  
  try {
    console.log('🔧 Agregando columna deleted_at para soft delete...\n');
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexión a MySQL establecida');
    
    // Verificar si la columna ya existe
    const [existingColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'deleted_at'
    `, [dbConfig.database]);
    
    if (existingColumns.length > 0) {
      console.log('⚪ Columna deleted_at ya existe');
    } else {
      console.log('📝 Agregando columna deleted_at...');
      
      await connection.execute(`
        ALTER TABLE orders 
        ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL,
        ADD INDEX idx_deleted_at (deleted_at)
      `);
      
      console.log('✅ Columna deleted_at agregada exitosamente');
    }
    
    // También agregar tabla de auditoría si no existe
    console.log('\n📝 Creando tabla de auditoría...');
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS orders_audit (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        action ENUM('CREATE', 'UPDATE', 'DELETE', 'RESTORE') NOT NULL,
        siigo_invoice_number VARCHAR(100),
        customer_name VARCHAR(100),
        user_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_order_id (order_id),
        INDEX idx_action (action),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✅ Tabla orders_audit creada');
    
    console.log('\n✅ Soft delete configurado exitosamente!');
    
  } catch (error) {
    console.error('❌ Error en la migración:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
};

// Ejecutar si se llama directamente
if (require.main === module) {
  addSoftDeleteColumn();
}

module.exports = { addSoftDeleteColumn };
