const { query } = require('./backend/config/database');

async function fixUnassignedMessengerOrders() {
  console.log('🔧 Asignando mensajeros a pedidos sin asignación...\n');

  try {
    // 1. Obtener pedidos sin mensajero asignado en estados que requieren mensajero
    const unassignedOrders = await query(`
      SELECT id, order_number, customer_name, status, delivery_method
      FROM orders 
      WHERE status IN ('en_reparto', 'listo_para_entrega') 
      AND (assigned_messenger_id IS NULL OR assigned_messenger_id = 0)
      AND delivery_method IN ('domicilio', 'mensajeria_urbana')
      ORDER BY created_at DESC
    `);

    if (unassignedOrders.length === 0) {
      console.log('✅ No hay pedidos sin mensajero para asignar');
      return;
    }

    console.log(`📦 Encontrados ${unassignedOrders.length} pedidos sin mensajero asignado:`);
    unassignedOrders.forEach((order, index) => {
      console.log(`${index + 1}. ${order.order_number} - ${order.customer_name} (${order.status})`);
    });

    // 2. Obtener mensajeros disponibles
    const messengers = await query(`
      SELECT id, username, full_name 
      FROM users 
      WHERE role = 'mensajero' AND active = 1
      ORDER BY id
    `);

    if (messengers.length === 0) {
      console.log('❌ No hay mensajeros activos disponibles');
      return;
    }

    console.log(`\n👥 Mensajeros disponibles: ${messengers.length}`);
    messengers.forEach(messenger => {
      console.log(`   - ${messenger.username} (${messenger.full_name}) - ID: ${messenger.id}`);
    });

    // 3. Asignar mensajeros de forma alternada
    console.log('\n🔄 Asignando mensajeros...');
    let messengerIndex = 0;
    
    for (const order of unassignedOrders) {
      const selectedMessenger = messengers[messengerIndex % messengers.length];
      
      await query(`
        UPDATE orders 
        SET assigned_messenger_id = ?, 
            messenger_status = 'assigned'
        WHERE id = ?
      `, [selectedMessenger.id, order.id]);
      
      console.log(`✅ ${order.order_number} → ${selectedMessenger.username} (ID: ${selectedMessenger.id})`);
      
      messengerIndex++;
    }

    // 4. Verificar las asignaciones
    console.log('\n🔍 Verificando asignaciones...');
    const updatedOrders = await query(`
      SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.status,
        o.assigned_messenger_id,
        o.messenger_status,
        u.username as messenger_username,
        u.full_name as messenger_name
      FROM orders o
      LEFT JOIN users u ON o.assigned_messenger_id = u.id
      WHERE o.id IN (${unassignedOrders.map(o => o.id).join(',')})
      ORDER BY o.order_number
    `);

    console.log('📋 PEDIDOS ACTUALIZADOS:');
    updatedOrders.forEach((order, index) => {
      console.log(`${index + 1}. ${order.order_number}`);
      console.log(`   👤 Cliente: ${order.customer_name}`);
      console.log(`   📍 Estado: ${order.status}`);
      console.log(`   👨‍💼 Mensajero: ${order.messenger_name} (${order.messenger_username})`);
      console.log(`   📱 Status: ${order.messenger_status}`);
      console.log('');
    });

    console.log('🎉 ¡Asignación completada!');
    console.log(`✅ ${unassignedOrders.length} pedidos ahora tienen mensajero asignado`);
    console.log('📱 Recarga la página de admin para ver los cambios');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar
if (require.main === module) {
  fixUnassignedMessengerOrders().then(() => {
    console.log('\n🏁 Proceso completado');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { fixUnassignedMessengerOrders };
