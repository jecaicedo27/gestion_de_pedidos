const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestion_pedidos',
  port: process.env.DB_PORT || 3306
};

async function addShippingDateColumn() {
  let connection;
  
  try {
    console.log('🔄 Conectando a la base de datos...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('✅ Conexión establecida');
    
    // Verificar si la columna ya existe
    console.log('🔍 Verificando si la columna shipping_date ya existe...');
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'shipping_date'
    `, [dbConfig.database]);
    
    if (columns.length > 0) {
      console.log('ℹ️  La columna shipping_date ya existe en la tabla orders');
      return;
    }
    
    // Agregar la columna
    console.log('📝 Agregando columna shipping_date a la tabla orders...');
    await connection.execute(`
      ALTER TABLE orders 
      ADD COLUMN shipping_date DATE NULL 
      COMMENT 'Fecha programada de envío para logística'
    `);
    
    console.log('✅ Columna shipping_date agregada exitosamente');
    
    // Verificar la estructura actualizada
    console.log('🔍 Verificando estructura de la tabla orders...');
    const [structure] = await connection.execute('DESCRIBE orders');
    
    console.log('📋 Estructura actual de la tabla orders:');
    structure.forEach(column => {
      console.log(`  - ${column.Field}: ${column.Type} ${column.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${column.Key ? `(${column.Key})` : ''}`);
    });
    
    console.log('🎉 Migración completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
}

// Ejecutar la migración
if (require.main === module) {
  addShippingDateColumn();
}

module.exports = { addShippingDateColumn };
