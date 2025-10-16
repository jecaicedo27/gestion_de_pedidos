const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function fixMensajeriaLocal() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sistema_pedidos'
  });

  try {
    console.log('🔧 SOLUCIONANDO MENSAJERÍA LOCAL\n');

    // 1. Actualizar pedidos vacíos que deberían ser mensajería local
    console.log('1️⃣ Actualizando pedidos sin método de entrega definido a "mensajeria_local"...');
    
    // Primero ver cuántos hay
    const [emptyOrders] = await connection.execute(
      `SELECT COUNT(*) as count FROM orders 
       WHERE (delivery_method = '' OR delivery_method IS NULL) 
       AND status IN ('listo_para_entrega', 'empacado', 'listo')`
    );
    
    console.log(`   Encontrados ${emptyOrders[0].count} pedidos sin método de entrega`);
    
    if (emptyOrders[0].count > 0) {
      // Actualizar a mensajeria_local
      const [updateResult] = await connection.execute(
        `UPDATE orders 
         SET delivery_method = 'mensajeria_local' 
         WHERE (delivery_method = '' OR delivery_method IS NULL) 
         AND status IN ('listo_para_entrega', 'empacado', 'listo')`
      );
      
      console.log(`   ✅ ${updateResult.affectedRows} pedidos actualizados a "mensajeria_local"`);
    }

    // 2. Verificar los valores actualizados
    console.log('\n2️⃣ Valores de delivery_method después de la actualización:');
    const [deliveryMethods] = await connection.execute(
      `SELECT delivery_method, COUNT(*) as count 
       FROM orders 
       WHERE status IN ('listo_para_entrega', 'empacado', 'listo')
       GROUP BY delivery_method`
    );
    
    deliveryMethods.forEach(dm => {
      console.log(`   - ${dm.delivery_method || 'NULL'}: ${dm.count} pedidos`);
    });

    // 3. Mostrar pedidos de mensajería local
    console.log('\n3️⃣ Pedidos de mensajería local listos para entrega:');
    const [mensajeriaOrders] = await connection.execute(
      `SELECT id, order_number, customer_name, total_amount 
       FROM orders 
       WHERE delivery_method = 'mensajeria_local' 
       AND status IN ('listo_para_entrega', 'empacado', 'listo')
       ORDER BY created_at DESC`
    );
    
    if (mensajeriaOrders.length > 0) {
      mensajeriaOrders.forEach(order => {
        console.log(`   📦 ${order.order_number} - ${order.customer_name} - $${order.total_amount}`);
      });
    } else {
      console.log('   No hay pedidos de mensajería local');
    }

    // 4. Crear un script para actualizar el controlador
    console.log('\n4️⃣ ACTUALIZACIÓN REQUERIDA EN EL BACKEND:');
    console.log('   El archivo backend/controllers/logisticsController.js necesita ser actualizado');
    console.log('   para reconocer "mensajeria_local" en la función getReadyForDeliveryOrders');
    
    console.log('\n✅ SOLUCIÓN COMPLETADA');
    console.log('   - Los pedidos sin método de entrega ahora son "mensajeria_local"');
    console.log('   - Próximo paso: actualizar el controlador del backend');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

fixMensajeriaLocal();
