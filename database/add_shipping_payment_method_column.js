const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

async function addShippingPaymentMethodColumn() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('📊 AGREGANDO COLUMNA MÉTODO DE PAGO DE ENVÍO');
    console.log('==========================================\n');
    
    // Verificar si la columna ya existe
    const [columns] = await connection.execute(
      `SHOW COLUMNS FROM orders LIKE 'shipping_payment_method'`
    );
    
    if (columns.length > 0) {
      console.log('✅ La columna shipping_payment_method ya existe');
    } else {
      console.log('📝 Agregando columna shipping_payment_method...');
      
      await connection.execute(`
        ALTER TABLE orders 
        ADD COLUMN shipping_payment_method VARCHAR(50) NULL 
        COMMENT 'Método de pago para el envío (contado, contraentrega, etc.)'
        AFTER payment_method
      `);
      
      console.log('✅ Columna shipping_payment_method agregada exitosamente');
    }
    
    // Verificar estructura actualizada
    console.log('\n📋 ESTRUCTURA ACTUALIZADA:');
    const [updatedColumns] = await connection.execute(
      `DESCRIBE orders`
    );
    
    updatedColumns
      .filter(col => col.Field.includes('payment') || col.Field.includes('shipping'))
      .forEach(col => {
        console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(NULL)' : '(NOT NULL)'}`);
      });
    
    console.log('\n🎯 PRÓXIMOS PASOS:');
    console.log('- Actualizar modal de logística para incluir campo');
    console.log('- Extraer automáticamente desde notas SIIGO');
    console.log('- Permitir edición manual por usuario de logística');
    
    await connection.end();
    console.log('\n✅ Migración completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar
addShippingPaymentMethodColumn();
