const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

async function fixDeliveryMethodEnum() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('🔧 FIX: SINCRONIZAR ENUM CON TABLA delivery_methods');
    console.log('===================================================\n');
    
    // 1. Obtener todos los códigos de delivery_methods activos
    const [methods] = await connection.execute(
      'SELECT code FROM delivery_methods WHERE active = 1 ORDER BY code'
    );
    
    console.log('📋 Métodos en delivery_methods:');
    methods.forEach(m => console.log(`   - ${m.code}`));
    
    // 2. Obtener el ENUM actual
    const [columns] = await connection.execute(
      "SHOW COLUMNS FROM orders WHERE Field = 'delivery_method'"
    );
    
    console.log('\n📊 ENUM actual en orders.delivery_method:');
    console.log(columns[0].Type);
    
    // 3. Construir nuevo ENUM con todos los valores necesarios
    const enumValues = methods.map(m => `'${m.code}'`).join(',');
    const alterQuery = `ALTER TABLE orders MODIFY COLUMN delivery_method ENUM(${enumValues}) DEFAULT NULL`;
    
    console.log('\n🚀 Ejecutando actualización del ENUM...');
    console.log('Query:', alterQuery);
    
    await connection.execute(alterQuery);
    
    console.log('\n✅ ENUM actualizado exitosamente!');
    
    // 4. Verificar el nuevo ENUM
    const [newColumns] = await connection.execute(
      "SHOW COLUMNS FROM orders WHERE Field = 'delivery_method'"
    );
    
    console.log('\n📊 NUEVO ENUM en orders.delivery_method:');
    console.log(newColumns[0].Type);
    
    // 5. Ahora actualizar el pedido FV-2-12666 con el método correcto
    console.log('\n🔄 Actualizando pedido FV-2-12666...');
    await connection.execute(
      "UPDATE orders SET delivery_method = 'nacional' WHERE order_number = 'FV-2-12666'"
    );
    
    // Verificar
    const [order] = await connection.execute(
      "SELECT order_number, delivery_method FROM orders WHERE order_number = 'FV-2-12666'"
    );
    
    console.log(`\n✅ Pedido actualizado: ${order[0].order_number} - Método: "${order[0].delivery_method}"`);
    
    console.log('\n🎯 SOLUCIÓN APLICADA:');
    console.log('1. ENUM sincronizado con delivery_methods');
    console.log('2. Ahora acepta: domicilio, mensajeria_urbana, nacional, recoge_bodega');
    console.log('3. El modal de facturación debería funcionar correctamente');
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar
fixDeliveryMethodEnum();
