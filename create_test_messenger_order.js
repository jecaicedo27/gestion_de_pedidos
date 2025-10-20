const { query } = require('./backend/config/database');

async function createTestMessengerOrder() {
  console.log('🔧 Creando pedido de prueba para mensajero...\n');

  try {
    // 1. Buscar el mensajero1
    const messenger = await query(`
      SELECT id, username, full_name 
      FROM users 
      WHERE username = 'mensajero1' OR id = 15
      LIMIT 1
    `);

    if (!messenger.length) {
      console.log('❌ No se encontró el mensajero. Creando uno...');
      
      const newMessenger = await query(`
        INSERT INTO users (username, password_hash, role, full_name, created_at) 
        VALUES ('mensajero_test', '$2b$10$example', 'mensajero', 'Mensajero de Prueba', NOW())
      `);
      
      console.log(`✅ Mensajero creado con ID: ${newMessenger.insertId}`);
      messenger.push({ id: newMessenger.insertId, username: 'mensajero_test', full_name: 'Mensajero de Prueba' });
    }

    const messengerId = messenger[0].id;
    const messengerName = messenger[0].full_name || messenger[0].username;
    console.log(`👤 Usando mensajero: ${messengerName} (ID: ${messengerId})`);

    // 2. Crear pedido de prueba
    console.log('\n📦 Creando pedido de prueba...');
    
    const orderResult = await query(`
      INSERT INTO orders (
        order_number,
        customer_name,
        customer_phone,
        customer_address,
        total_amount,
        status,
        delivery_method,
        assigned_messenger_id,
        messenger_status,
        created_by,
        created_at,
        shipping_date
      ) VALUES (
        ?,
        'Cliente de Prueba para Mensajero',
        '3001234567',
        'Calle 123 #45-67, Bogotá',
        50000,
        'listo_para_entrega',
        'mensajeria_local',
        ?,
        'assigned',
        ?,
        NOW(),
        CURDATE()
      )
    `, [
      `TEST-MSG-${Date.now()}`,
      messengerId,
      messengerId
    ]);

    const orderId = orderResult.insertId;
    console.log(`✅ Pedido creado con ID: ${orderId}`);

    // 3. Agregar items al pedido
    console.log('📋 Agregando items al pedido...');
    
    await query(`
      INSERT INTO order_items (
        order_id,
        product_code,
        product_name,
        quantity,
        unit_price,
        total_price
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      orderId,
      'TEST-001',
      'Producto de Prueba para Mensajero',
      2,
      25000,
      50000
    ]);

    // 4. Crear registro de tracking
    console.log('📊 Creando registro de tracking...');
    
    await query(`
      INSERT INTO delivery_tracking (
        order_id,
        messenger_id,
        assigned_at
      ) VALUES (?, ?, NOW())
    `, [orderId, messengerId]);

    // 5. Verificar el pedido creado
    console.log('\n🔍 Verificando pedido creado:');
    
    const createdOrder = await query(`
      SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.status,
        o.delivery_method,
        o.assigned_messenger_id,
        o.messenger_status,
        o.total_amount,
        u.username as messenger_name
      FROM orders o
      LEFT JOIN users u ON o.assigned_messenger_id = u.id
      WHERE o.id = ?
    `, [orderId]);

    const order = createdOrder[0];
    console.log(`📦 Pedido: ${order.order_number}`);
    console.log(`👤 Cliente: ${order.customer_name}`);
    console.log(`💰 Monto: $${order.total_amount.toLocaleString('es-CO')}`);
    console.log(`📍 Estado: ${order.status}`);
    console.log(`🚚 Método: ${order.delivery_method}`);
    console.log(`👨‍💼 Mensajero: ${order.messenger_name} (ID: ${order.assigned_messenger_id})`);
    console.log(`📱 Messenger Status: ${order.messenger_status}`);

    console.log('\n✅ ¡Pedido de prueba creado exitosamente!');
    console.log('🎯 Ahora el mensajero debería ver el botón "Aceptar" para este pedido');
    console.log(`📲 Número de pedido: ${order.order_number}`);

  } catch (error) {
    console.error('❌ Error creando pedido de prueba:', error);
  }
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  createTestMessengerOrder().then(() => {
    console.log('\n🏁 Proceso completado');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { createTestMessengerOrder };
