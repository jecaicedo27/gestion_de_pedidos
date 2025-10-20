const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'backend/.env' });

async function testMessengerAssignment() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos_dev'
  });

  try {
    console.log('🧪 Iniciando test de asignación de mensajeros...');
    
    // 1. Verificar mensajeros disponibles en tabla users
    const [messengers] = await connection.execute(
      'SELECT id, full_name, username FROM users WHERE role = "mensajero" AND active = TRUE',
      []
    );
    
    console.log(`📋 Mensajeros encontrados: ${messengers.length}`);
    messengers.forEach(m => {
      console.log(`- ID: ${m.id}, Nombre: ${m.full_name || 'N/A'}, Username: ${m.username}`);
    });
    
    if (messengers.length === 0) {
      console.log('❌ No hay mensajeros disponibles para el test');
      return;
    }

    // 2. Buscar un pedido en estado 'listo_para_entrega' o crear uno de prueba
    let [testOrders] = await connection.execute(
      'SELECT id, order_number, status FROM orders WHERE status IN ("listo_para_entrega", "empacado", "listo") LIMIT 1',
      []
    );

    if (testOrders.length === 0) {
      // Crear un pedido de prueba
      console.log('📦 Creando pedido de prueba...');
      const [newOrder] = await connection.execute(
        `INSERT INTO orders (order_number, customer_name, status, delivery_method, total_amount, created_at) 
         VALUES (?, ?, ?, ?, ?, NOW())`,
        ['TEST-MSG-001', 'Cliente Test Mensajero', 'listo_para_entrega', 'mensajeria_local', 50000.00]
      );
      
      testOrders = [{ id: newOrder.insertId, order_number: 'TEST-MSG-001', status: 'listo_para_entrega' }];
      console.log(`✅ Pedido de prueba creado: ID ${newOrder.insertId}`);
    }

    const testOrder = testOrders[0];
    const testMessenger = messengers[0];
    
    console.log(`\n🎯 Test: Asignando mensajero ${testMessenger.id} (${testMessenger.full_name || testMessenger.username}) al pedido ${testOrder.id} (${testOrder.order_number})`);

    // 3. Simular la asignación que hace el controlador
    await connection.execute(
      `UPDATE orders 
       SET assigned_messenger = ?, status = 'en_reparto', updated_at = NOW()
       WHERE id = ?`,
      [testMessenger.id, testOrder.id]
    );

    console.log('✅ Asignación ejecutada correctamente');

    // 4. Verificar que la asignación se guardó
    const [updatedOrder] = await connection.execute(
      'SELECT id, order_number, status, assigned_messenger FROM orders WHERE id = ?',
      [testOrder.id]
    );

    if (updatedOrder.length > 0) {
      const order = updatedOrder[0];
      console.log(`\n📋 Resultado del test:`);
      console.log(`- Pedido: ${order.order_number}`);
      console.log(`- Estado: ${order.status}`);
      console.log(`- Mensajero asignado: ${order.assigned_messenger}`);
      
      if (order.status === 'en_reparto' && order.assigned_messenger == testMessenger.id) {
        console.log('✅ ¡TEST EXITOSO! La asignación funciona correctamente');
      } else {
        console.log('❌ TEST FALLIDO: Los datos no coinciden con lo esperado');
      }
    } else {
      console.log('❌ TEST FALLIDO: No se pudo recuperar el pedido actualizado');
    }

    // 5. Limpiar el pedido de prueba si lo creamos
    if (testOrder.order_number === 'TEST-MSG-001') {
      await connection.execute('DELETE FROM orders WHERE id = ?', [testOrder.id]);
      console.log('🧹 Pedido de prueba eliminado');
    }

  } catch (error) {
    console.error('❌ Error en el test:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await connection.end();
  }
}

testMessengerAssignment().catch(console.error);
