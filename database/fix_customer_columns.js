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

const fixCustomerColumns = async () => {
  let connection;
  
  try {
    console.log('🔧 Conectando a la base de datos...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexión establecida');

    // Verificar columnas existentes
    console.log('🔍 Verificando columnas existentes...');
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'orders'
        AND COLUMN_NAME IN ('customer_department', 'customer_city')
    `, [dbConfig.database]);

    const existingColumns = columns.map(col => col.COLUMN_NAME);
    console.log('📋 Columnas existentes:', existingColumns);

    // Agregar customer_department si no existe
    if (!existingColumns.includes('customer_department')) {
      console.log('➕ Agregando columna customer_department...');
      await connection.execute(`
        ALTER TABLE orders 
        ADD COLUMN customer_department VARCHAR(100) AFTER customer_email
      `);
      console.log('✅ Columna customer_department agregada');
    } else {
      console.log('ℹ️  La columna customer_department ya existe');
    }

    // Agregar customer_city si no existe
    if (!existingColumns.includes('customer_city')) {
      console.log('➕ Agregando columna customer_city...');
      await connection.execute(`
        ALTER TABLE orders 
        ADD COLUMN customer_city VARCHAR(100) AFTER customer_department
      `);
      console.log('✅ Columna customer_city agregada');
    } else {
      console.log('ℹ️  La columna customer_city ya existe');
    }

    // Verificar la estructura final
    console.log('🔍 Verificando estructura final de la tabla orders...');
    const [structure] = await connection.execute('DESCRIBE orders');
    
    console.log('📋 Estructura actual de la tabla orders:');
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
  fixCustomerColumns();
}

module.exports = { fixCustomerColumns };
