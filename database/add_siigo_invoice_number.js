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

const addSiigoInvoiceNumber = async () => {
  let connection;
  
  try {
    console.log('🔧 Conectando a la base de datos...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexión establecida');

    // Verificar si la columna siigo_invoice_number existe en orders
    console.log('🔍 Verificando si la columna siigo_invoice_number existe...');
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'orders'
        AND COLUMN_NAME = 'siigo_invoice_number'
    `, [dbConfig.database]);

    if (columns.length > 0) {
      console.log('ℹ️  La columna siigo_invoice_number ya existe');
    } else {
      console.log('➕ Agregando columna siigo_invoice_number a orders...');
      await connection.execute(`
        ALTER TABLE orders 
        ADD COLUMN siigo_invoice_number VARCHAR(100) AFTER invoice_code
      `);
      console.log('✅ Columna siigo_invoice_number agregada');
    }

    // Verificar si la columna siigo_invoice_id existe en orders
    console.log('🔍 Verificando si la columna siigo_invoice_id existe...');
    const [columns2] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'orders'
        AND COLUMN_NAME = 'siigo_invoice_id'
    `, [dbConfig.database]);

    if (columns2.length > 0) {
      console.log('ℹ️  La columna siigo_invoice_id ya existe');
    } else {
      console.log('➕ Agregando columna siigo_invoice_id a orders...');
      await connection.execute(`
        ALTER TABLE orders 
        ADD COLUMN siigo_invoice_id VARCHAR(100) AFTER siigo_invoice_number
      `);
      console.log('✅ Columna siigo_invoice_id agregada');
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
  addSiigoInvoiceNumber();
}

module.exports = { addSiigoInvoiceNumber };
