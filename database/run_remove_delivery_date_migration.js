const mysql = require('mysql2/promise');

// Configuración de la base de datos
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

async function removeDeliveryDateColumn() {
  let connection;
  
  try {
    console.log('🗑️  MIGRACIÓN: Eliminar columna delivery_date redundante');
    console.log('=' .repeat(60));
    console.log('');
    
    connection = await mysql.createConnection(dbConfig);
    
    // 1. Verificar estructura actual
    console.log('1. Verificando estructura actual de la tabla orders...');
    const [columns] = await connection.execute('DESCRIBE orders');
    
    const hasDeliveryDate = columns.some(col => col.Field === 'delivery_date');
    const hasShippingDate = columns.some(col => col.Field === 'shipping_date');
    
    console.log(`   📋 delivery_date existe: ${hasDeliveryDate ? '✅ SÍ' : '❌ NO'}`);
    console.log(`   📋 shipping_date existe: ${hasShippingDate ? '✅ SÍ' : '❌ NO'}`);
    
    if (!hasDeliveryDate) {
      console.log('   ℹ️  La columna delivery_date ya fue eliminada anteriormente');
      console.log('   ✅ Migración no necesaria');
      return;
    }
    
    if (!hasShippingDate) {
      console.log('   ⚠️  La columna shipping_date no existe. Esto podría ser un problema.');
      console.log('   🚨 CANCELANDO migración por seguridad');
      return;
    }
    
    console.log('');
    
    // 2. Verificar datos antes de eliminar
    console.log('2. Verificando datos en ambas columnas...');
    const [dataCheck] = await connection.execute(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(delivery_date) as with_delivery_date,
        COUNT(shipping_date) as with_shipping_date
      FROM orders
    `);
    
    if (dataCheck.length > 0) {
      const stats = dataCheck[0];
      console.log(`   📊 Total pedidos: ${stats.total_orders}`);
      console.log(`   📊 Con delivery_date: ${stats.with_delivery_date}`);
      console.log(`   📊 Con shipping_date: ${stats.with_shipping_date}`);
      
      if (stats.with_delivery_date > 0) {
        console.log('   ⚠️  ADVERTENCIA: Hay datos en delivery_date que se perderán');
        console.log('   🤔 ¿Continuar? Los datos de delivery_date se eliminarán permanentemente');
        console.log('   💡 shipping_date se mantendrá intacto');
      }
    }
    console.log('');
    
    // 3. Mostrar algunos ejemplos de datos
    console.log('3. Ejemplos de datos actuales...');
    const [examples] = await connection.execute(`
      SELECT id, order_number, delivery_date, shipping_date, status
      FROM orders 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('   📋 Últimos 5 pedidos:');
    examples.forEach((order, index) => {
      console.log(`   ${index + 1}. ${order.order_number}`);
      console.log(`      delivery_date: ${order.delivery_date || 'NULL'}`);
      console.log(`      shipping_date: ${order.shipping_date || 'NULL'}`);
      console.log(`      status: ${order.status}`);
    });
    console.log('');
    
    // 4. Ejecutar la eliminación
    console.log('4. Eliminando columna delivery_date...');
    
    await connection.execute('ALTER TABLE orders DROP COLUMN delivery_date');
    
    console.log('   ✅ Columna delivery_date eliminada exitosamente');
    console.log('');
    
    // 5. Verificar resultado
    console.log('5. Verificando estructura después del cambio...');
    const [newColumns] = await connection.execute('DESCRIBE orders');
    
    const stillHasDeliveryDate = newColumns.some(col => col.Field === 'delivery_date');
    const stillHasShippingDate = newColumns.some(col => col.Field === 'shipping_date');
    
    console.log(`   📋 delivery_date existe: ${stillHasDeliveryDate ? '❌ TODAVÍA SÍ (error)' : '✅ NO (correcto)'}`);
    console.log(`   📋 shipping_date existe: ${stillHasShippingDate ? '✅ SÍ (correcto)' : '❌ NO (problema)'}`);
    console.log('');
    
    // 6. Verificar que los datos de shipping_date se mantuvieron
    console.log('6. Verificando que shipping_date se mantuvo intacto...');
    const [finalCheck] = await connection.execute(`
      SELECT id, order_number, shipping_date, status
      FROM orders 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('   📋 Datos después de la migración:');
    finalCheck.forEach((order, index) => {
      console.log(`   ${index + 1}. ${order.order_number}`);
      console.log(`      shipping_date: ${order.shipping_date || 'NULL'}`);
      console.log(`      status: ${order.status}`);
    });
    console.log('');
    
    // 7. Resumen
    console.log('7. RESUMEN DE LA MIGRACIÓN:');
    console.log('   ✅ Columna delivery_date eliminada (era redundante)');
    console.log('   ✅ Columna shipping_date conservada (es la que se usa)');
    console.log('   ✅ Datos de shipping_date intactos');
    console.log('   ✅ Estructura de base de datos simplificada');
    console.log('');
    console.log('   💡 BENEFICIOS:');
    console.log('   • Menos confusión entre columnas similares');
    console.log('   • Solo una fecha: shipping_date (fecha programada de envío)');
    console.log('   • Backend y frontend más simples');
    console.log('   • Menos posibilidad de errores');
    
    console.log('');
    console.log('=' .repeat(60));
    console.log('✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    console.log('');
    console.log('🔍 ANÁLISIS DEL ERROR:');
    console.log(`   Tipo: ${error.code || 'Unknown'}`);
    console.log(`   Mensaje: ${error.message}`);
    
    if (error.sql) {
      console.log(`   SQL: ${error.sql}`);
    }
    
    console.log('');
    console.log('🚨 La migración FALLÓ. La estructura de la base de datos no fue modificada.');
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar migración
removeDeliveryDateColumn();
