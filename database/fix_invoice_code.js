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

const fixInvoiceCode = async () => {
  let connection;
  
  try {
    console.log('🔧 Conectando a la base de datos...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexión establecida');

    // Verificar si la columna ya existe
    console.log('🔍 Verificando si la columna invoice_code existe...');
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'orders' 
        AND COLUMN_NAME = 'invoice_code'
    `, [dbConfig.database]);

    if (columns.length > 0) {
      console.log('ℹ️  La columna invoice_code ya existe');
    } else {
      console.log('➕ Agregando columna invoice_code...');
      await connection.execute(`
        ALTER TABLE orders 
        ADD COLUMN invoice_code VARCHAR(50) AFTER order_number
      `);
      console.log('✅ Columna invoice_code agregada');

      console.log('📊 Creando índice para invoice_code...');
      await connection.execute(`
        CREATE INDEX idx_invoice_code ON orders(invoice_code)
      `);
      console.log('✅ Índice creado');
    }

    // Verificar la estructura final
    console.log('🔍 Verificando estructura de la tabla orders...');
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
  fixInvoiceCode();
}

module.exports = { fixInvoiceCode };
