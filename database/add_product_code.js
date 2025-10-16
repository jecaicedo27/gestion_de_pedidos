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

const addProductCode = async () => {
  let connection;
  
  try {
    console.log('🔧 Conectando a la base de datos...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexión establecida');

    // Verificar si la columna product_code existe en order_items
    console.log('🔍 Verificando si la columna product_code existe...');
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'order_items'
        AND COLUMN_NAME = 'product_code'
    `, [dbConfig.database]);

    if (columns.length > 0) {
      console.log('ℹ️  La columna product_code ya existe');
    } else {
      console.log('➕ Agregando columna product_code a order_items...');
      await connection.execute(`
        ALTER TABLE order_items 
        ADD COLUMN product_code VARCHAR(100) AFTER name
      `);
      console.log('✅ Columna product_code agregada');
    }

    // Verificar la estructura final
    console.log('🔍 Verificando estructura final de la tabla order_items...');
    const [structure] = await connection.execute('DESCRIBE order_items');
    
    console.log('📋 Estructura actual de la tabla order_items:');
    structure.forEach(column => {
      console.log(`  - ${column.Field}: ${column.Type} ${column.Null === 'YES' ? '(NULL)' : '(NOT NULL)'} ${column.Key ? `[${column.Key}]` : ''}`);
    });

    console.log('\n✅ Corrección completada exitosamente!');

  } catch (error) {
    console.error('❌ Error:', error.message);
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
  addProductCode();
}

module.exports = { addProductCode };
