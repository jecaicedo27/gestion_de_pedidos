const { query, poolEnd } = require('./backend/config/database');

async function debugMessengerOrderStatus() {
  console.log('🔍 Diagnosticando estado de pedidos de mensajeros...\n');

  try {
    // 1. Verificar pedidos asignados a mensajeros
    console.log('📋 1. Verificando pedidos asignados a mensajeros:');
    const assignedOrders = await query(`
      SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.status,
        o.delivery_method,
        o.assigned_messenger_id,
        o.messenger_status,
        u.username as messenger_name,
        u.full_name as messenger_full_name
      FROM orders o
      LEFT JOIN users u ON o.assigned_messenger_id = u.id
      WHERE o.assigned_messenger_id IS NOT NULL
      ORDER BY o.created_at DESC
      LIMIT 10
    `);

    if (assignedOrders.length === 0) {
      console.log('❌ No se encontraron pedidos asignados a mensajeros');
    } else {
      console.log(`✅ Encontrados ${assignedOrders.length} pedidos asignados:`);
      assignedOrders.forEach(order => {
        console.log(`  📦 ${order.order_number} -> ${order.messenger_name || order.messenger_full_name || 'Sin nombre'}`);
        console.log(`      Estado: ${order.status}, Messenger Status: ${order.messenger_status || 'NULL'}`);
        console.log(`      Método: ${order.delivery_method || 'NULL'}`);
        console.log('');
      });
    }

    // 2. Verificar usuarios mensajeros
    console.log('👥 2. Verificando usuarios con rol mensajero:');
    const messengers = await query(`
      SELECT id, username, full_name, role, created_at
      FROM users 
      WHERE role = 'mensajero'
      ORDER BY created_at DESC
    `);

    if (messengers.length === 0) {
      console.log('❌ No se encontraron usuarios con rol mensajero');
    } else {
      console.log(`✅ Encontrados ${messengers.length} mensajeros:`);
      messengers.forEach(messenger => {
        console.log(`  👤 ID: ${messenger.id} - ${messenger.username} (${messenger.full_name || 'Sin nombre completo'})`);
      });
    }

    // 3. Verificar pedidos que deberían estar disponibles para mensajeros
    console.log('\n🚚 3. Verificando pedidos listos para mensajería:');
    const readyOrders = await query(`
      SELECT 
        id,
        order_number,
        customer_name,
        status,
        delivery_method,
        assigned_messenger_id,
        messenger_status
      FROM orders 
      WHERE status = 'empacado' 
        OR (status = 'listo_para_entrega' AND delivery_method IN ('mensajeria_local', 'domicilio', 'mensajeria_urbana'))
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (readyOrders.length === 0) {
      console.log('❌ No hay pedidos listos para mensajería');
    } else {
      console.log(`✅ Encontrados ${readyOrders.length} pedidos listos:`);
      readyOrders.forEach(order => {
        console.log(`  📦 ${order.order_number} - ${order.status}`);
        console.log(`      Método: ${order.delivery_method || 'NULL'}`);
        console.log(`      Asignado a: ${order.assigned_messenger_id || 'Ninguno'}`);
        console.log(`      Messenger Status: ${order.messenger_status || 'NULL'}`);
        console.log('');
      });
    }

    // 4. Corregir pedidos con asignación pero sin messenger_status
    console.log('🔧 4. Corrigiendo pedidos asignados sin messenger_status:');
    const ordersToFix = await query(`
      SELECT id, order_number, assigned_messenger_id, messenger_status
      FROM orders 
      WHERE assigned_messenger_id IS NOT NULL 
        AND (messenger_status IS NULL OR messenger_status = '')
    `);

    if (ordersToFix.length === 0) {
      console.log('✅ No hay pedidos que requieran corrección');
    } else {
      console.log(`🛠️  Corrigiendo ${ordersToFix.length} pedidos...`);
      
      for (const order of ordersToFix) {
        await query(`
          UPDATE orders 
          SET messenger_status = 'assigned' 
          WHERE id = ?
        `, [order.id]);
        
        console.log(`  ✅ ${order.order_number} - messenger_status establecido como 'assigned'`);
      }
    }

    // 5. Mostrar resultado final
    console.log('\n📊 5. Estado final de pedidos asignados:');
    const finalState = await query(`
      SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.status,
        o.delivery_method,
        o.assigned_messenger_id,
        o.messenger_status,
        u.username as messenger_name
      FROM orders o
      LEFT JOIN users u ON o.assigned_messenger_id = u.id
      WHERE o.assigned_messenger_id IS NOT NULL
      ORDER BY o.created_at DESC
      LIMIT 10
    `);

    finalState.forEach(order => {
      const statusIcon = order.messenger_status === 'assigned' ? '✅' : '⚠️';
      console.log(`  ${statusIcon} ${order.order_number} -> ${order.messenger_name || 'Sin nombre'}`);
      console.log(`      Estado: ${order.status}, Messenger Status: ${order.messenger_status || 'NULL'}`);
    });

    console.log('\n🎯 Resumen:');
    console.log(`- Total mensajeros: ${messengers.length}`);
    console.log(`- Pedidos asignados: ${assignedOrders.length}`);
    console.log(`- Pedidos corregidos: ${ordersToFix.length}`);
    
    if (ordersToFix.length > 0) {
      console.log('\n✅ Pedidos corregidos. Ahora los mensajeros deberían ver el botón "Aceptar"');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await poolEnd();
  }
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  debugMessengerOrderStatus();
}

module.exports = { debugMessengerOrderStatus };
