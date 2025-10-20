const { query } = require('./backend/config/database');

async function debugMessengerAssignments() {
  console.log('🔍 Depurando asignaciones de mensajeros...\n');

  try {
    // 1. Verificar pedidos con mensajeros asignados
    console.log('1. 📋 PEDIDOS CON MENSAJEROS ASIGNADOS:');
    const ordersWithMessengers = await query(`
      SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.status,
        o.assigned_messenger_id,
        o.messenger_status,
        u.username as messenger_username,
        u.full_name as messenger_full_name
      FROM orders o
      LEFT JOIN users u ON o.assigned_messenger_id = u.id
      WHERE o.assigned_messenger_id IS NOT NULL
      ORDER BY o.created_at DESC
      LIMIT 10
    `);

    if (ordersWithMessengers.length === 0) {
      console.log('❌ No hay pedidos con mensajeros asignados');
    } else {
      console.log(`✅ Encontrados ${ordersWithMessengers.length} pedidos con mensajeros:`);
      ordersWithMessengers.forEach((order, index) => {
        console.log(`\n${index + 1}. 📦 ${order.order_number}`);
        console.log(`   👤 Cliente: ${order.customer_name}`);
        console.log(`   📍 Estado: ${order.status}`);
        console.log(`   👨‍💼 Mensajero ID: ${order.assigned_messenger_id}`);
        console.log(`   📱 Messenger Status: ${order.messenger_status}`);
        console.log(`   👤 Username: ${order.messenger_username || 'N/A'}`);
        console.log(`   👨‍💼 Nombre: ${order.messenger_full_name || 'N/A'}`);
      });
    }

    // 2. Verificar específicamente pedidos en estado "en_reparto"
    console.log('\n\n2. 🚚 PEDIDOS EN ESTADO "EN_REPARTO":');
    const ordersInDelivery = await query(`
      SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.status,
        o.assigned_messenger_id,
        o.messenger_status,
        o.delivery_method,
        u.username as messenger_username,
        u.full_name as messenger_full_name
      FROM orders o
      LEFT JOIN users u ON o.assigned_messenger_id = u.id
      WHERE o.status = 'en_reparto'
      ORDER BY o.created_at DESC
    `);

    if (ordersInDelivery.length === 0) {
      console.log('❌ No hay pedidos en estado "en_reparto"');
    } else {
      console.log(`✅ Encontrados ${ordersInDelivery.length} pedidos en reparto:`);
      ordersInDelivery.forEach((order, index) => {
        console.log(`\n${index + 1}. 📦 ${order.order_number}`);
        console.log(`   👤 Cliente: ${order.customer_name}`);
        console.log(`   👨‍💼 Mensajero ID: ${order.assigned_messenger_id}`);
        console.log(`   📱 Status: ${order.messenger_status}`);
        console.log(`   🚚 Método: ${order.delivery_method}`);
        console.log(`   👤 Username: ${order.messenger_username || 'N/A'}`);
        console.log(`   👨‍💼 Nombre: ${order.messenger_full_name || 'N/A'}`);
      });
    }

    // 3. Verificar la consulta exacta que usa el backend
    console.log('\n\n3. 🔍 SIMULANDO CONSULTA DEL BACKEND:');
    const backendQuery = await query(`
      SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.client_name,
        o.customer_phone,
        o.client_phone,
        o.status,
        o.total_amount,
        o.delivery_method,
        o.shipping_date,
        o.assigned_messenger_id,
        o.messenger_status,
        u.username as assigned_messenger_name,
        u.full_name as messenger_name,
        u.username as messenger_username
      FROM orders o
      LEFT JOIN users u ON o.assigned_messenger_id = u.id
      WHERE o.status = 'en_reparto'
      ORDER BY o.created_at DESC
      LIMIT 5
    `);

    console.log(`Resultados de consulta backend: ${backendQuery.length} pedidos`);
    backendQuery.forEach((order, index) => {
      console.log(`\n${index + 1}. 📦 ${order.order_number}`);
      console.log(`   👨‍💼 assigned_messenger_id: ${order.assigned_messenger_id}`);
      console.log(`   📱 messenger_status: ${order.messenger_status}`);
      console.log(`   👤 assigned_messenger_name: ${order.assigned_messenger_name || 'NULL'}`);
      console.log(`   👨‍💼 messenger_name: ${order.messenger_name || 'NULL'}`);
      console.log(`   👤 messenger_username: ${order.messenger_username || 'NULL'}`);
    });

    // 4. Verificar estructura de la tabla orders
    console.log('\n\n4. 📋 ESTRUCTURA DE TABLA ORDERS (campos mensajero):');
    const tableStructure = await query(`DESCRIBE orders`);
    const messengerFields = tableStructure.filter(field => 
      field.Field.toLowerCase().includes('messenger') || 
      field.Field.toLowerCase().includes('assigned')
    );

    if (messengerFields.length === 0) {
      console.log('❌ No se encontraron campos relacionados con mensajeros');
    } else {
      messengerFields.forEach(field => {
        console.log(`✅ ${field.Field}: ${field.Type} (${field.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
      });
    }

    // 5. Verificar todos los estados de pedidos para entender la distribución
    console.log('\n\n5. 📊 DISTRIBUCIÓN DE ESTADOS DE PEDIDOS:');
    const statusDistribution = await query(`
      SELECT 
        status,
        COUNT(*) as count,
        COUNT(assigned_messenger_id) as with_messenger
      FROM orders 
      GROUP BY status
      ORDER BY count DESC
    `);

    statusDistribution.forEach(stat => {
      console.log(`📈 ${stat.status}: ${stat.count} pedidos (${stat.with_messenger} con mensajero)`);
    });

    // 6. Asignar mensajero a pedidos en estado "en_reparto" si no tienen
    console.log('\n\n6. 🔧 VERIFICANDO PEDIDOS SIN MENSAJERO EN "EN_REPARTO":');
    const unassignedInDelivery = await query(`
      SELECT id, order_number, status
      FROM orders 
      WHERE status = 'en_reparto' 
      AND (assigned_messenger_id IS NULL OR assigned_messenger_id = 0)
    `);

    if (unassignedInDelivery.length > 0) {
      console.log(`❌ Encontrados ${unassignedInDelivery.length} pedidos en reparto sin mensajero:`);
      unassignedInDelivery.forEach(order => {
        console.log(`   📦 ${order.order_number} (ID: ${order.id})`);
      });
      
      console.log('\n🔧 Asignando mensajero por defecto...');
      // Asignar al mensajero con ID 15 (mensajero1)
      for (const order of unassignedInDelivery) {
        await query(`
          UPDATE orders 
          SET assigned_messenger_id = 15, messenger_status = 'assigned'
          WHERE id = ?
        `, [order.id]);
        console.log(`✅ Asignado mensajero a ${order.order_number}`);
      }
    } else {
      console.log('✅ Todos los pedidos en reparto tienen mensajero asignado');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar
if (require.main === module) {
  debugMessengerAssignments().then(() => {
    console.log('\n🏁 Depuración completada');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { debugMessengerAssignments };
