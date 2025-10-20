const fetch = require('node-fetch');

async function debugMessengerOrderStates() {
  console.log('🔍 Debuggeando estados de pedidos para mensajeros...\n');

  try {
    // 1. Login como admin para ver todos los pedidos
    console.log('1. 🔐 Obteniendo token de admin...');
    const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error('No se pudo obtener token de admin');
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.data?.token;
    
    if (!token) {
      console.log('❌ No se pudo obtener token válido');
      return;
    }
    console.log('✅ Token de admin obtenido');

    // 2. Obtener todos los pedidos
    console.log('\n2. 📦 Obteniendo todos los pedidos...');
    const ordersResponse = await fetch('http://localhost:3001/api/orders', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!ordersResponse.ok) {
      throw new Error('Error obteniendo pedidos');
    }
    
    const ordersData = await ordersResponse.json();
    const orders = ordersData.data?.orders || [];
    console.log(`✅ ${orders.length} pedidos obtenidos`);

    // 3. Obtener lista de mensajeros
    console.log('\n3. 👥 Obteniendo mensajeros...');
    const usersResponse = await fetch('http://localhost:3001/api/users?role=mensajero', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!usersResponse.ok) {
      throw new Error('Error obteniendo mensajeros');
    }
    
    const usersData = await usersResponse.json();
    const messengers = usersData.data?.users || usersData.data || [];
    console.log(`✅ ${messengers.length} mensajeros encontrados:`);
    messengers.forEach(m => {
      console.log(`   - ID: ${m.id}, Usuario: ${m.username}, Nombre: ${m.full_name || 'Sin nombre'}`);
    });

    // 4. Filtrar pedidos con mensajeros asignados
    console.log('\n4. 🎯 ANÁLISIS DE PEDIDOS CON MENSAJEROS:');
    const ordersWithMessengers = orders.filter(order => order.assigned_messenger_id);
    console.log(`📊 ${ordersWithMessengers.length} pedidos tienen mensajeros asignados de ${orders.length} total`);

    if (ordersWithMessengers.length === 0) {
      console.log('⚠️ NO HAY PEDIDOS CON MENSAJEROS ASIGNADOS');
      console.log('   Esto explica por qué los mensajeros no ven opciones de aceptar pedidos.');
      
      // Buscar pedidos que podrían necesitar asignación
      console.log('\n5. 🔍 PEDIDOS QUE PODRÍAN NECESITAR ASIGNACIÓN:');
      const readyForMessengers = orders.filter(order => 
        ['listo_para_entrega', 'empacado', 'en_reparto'].includes(order.status) && 
        !order.assigned_messenger_id
      );
      
      if (readyForMessengers.length > 0) {
        console.log(`📦 ${readyForMessengers.length} pedidos sin mensajero asignado:`);
        readyForMessengers.forEach((order, index) => {
          console.log(`   ${index + 1}. ${order.order_number} - ${order.status} - Cliente: ${order.customer_name}`);
        });
      } else {
        console.log('   No hay pedidos listos para asignar a mensajeros');
      }
      return;
    }

    // 5. Detallar cada pedido con mensajero
    console.log('\n🔍 DETALLE DE PEDIDOS CON MENSAJEROS:');
    ordersWithMessengers.forEach((order, index) => {
      const messenger = messengers.find(m => m.id === order.assigned_messenger_id);
      const messengerName = messenger?.username || messenger?.full_name || `ID: ${order.assigned_messenger_id}`;
      
      console.log(`\n${index + 1}. 📦 ${order.order_number}`);
      console.log(`   👤 Cliente: ${order.customer_name}`);
      console.log(`   📍 Estado del pedido: ${order.status}`);
      console.log(`   🚚 Mensajero asignado: ${messengerName} (ID: ${order.assigned_messenger_id})`);
      console.log(`   📱 Estado del mensajero: ${order.messenger_status || 'NULL/undefined'}`);
      console.log(`   💰 Total: $${order.total_amount?.toLocaleString('es-CO') || '0'}`);
      console.log(`   📅 Fecha de envío: ${order.shipping_date || 'No definida'}`);
      
      // Análizar qué opciones vería este mensajero
      console.log(`   🎯 OPCIONES QUE VERÍA EL MENSAJERO:`);
      
      if (order.messenger_status === 'assigned') {
        console.log(`      ✅ [ACEPTAR PEDIDO] - Botón de check verde`);
        console.log(`      ❌ [RECHAZAR PEDIDO] - Botón de X roja`);
      } else if (order.messenger_status === 'accepted') {
        console.log(`      ▶️ [INICIAR ENTREGA] - Botón de play azul`);
      } else if (order.messenger_status === 'in_delivery') {
        console.log(`      📦 [COMPLETAR ENTREGA] - Botón de paquete morado`);
        console.log(`      ⚠️ [MARCAR ENTREGA FALLIDA] - Botón de triángulo naranja`);
      } else {
        console.log(`      👁️ [SOLO VER] - Solo opciones de visualización disponibles`);
        console.log(`      ⚠️ PROBLEMA: messenger_status = '${order.messenger_status}' no permite aceptar`);
      }
    });

    // 6. Resumen y recomendaciones
    console.log('\n📊 RESUMEN:');
    const statusCount = {};
    ordersWithMessengers.forEach(order => {
      const status = order.messenger_status || 'null/undefined';
      statusCount[status] = (statusCount[status] || 0) + 1;
    });
    
    console.log('   Estados de mensajero encontrados:');
    Object.entries(statusCount).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count} pedidos`);
    });

    // 7. Recomendaciones
    console.log('\n🎯 RECOMENDACIONES:');
    
    const needsAssignment = ordersWithMessengers.filter(o => !o.messenger_status || o.messenger_status === 'null');
    if (needsAssignment.length > 0) {
      console.log(`1. 🔧 ${needsAssignment.length} pedidos necesitan messenger_status = 'assigned':`);
      needsAssignment.forEach(order => {
        console.log(`   - ${order.order_number} (ID: ${order.id})`);
      });
    }

    const readyForAcceptance = ordersWithMessengers.filter(o => o.messenger_status === 'assigned');
    if (readyForAcceptance.length > 0) {
      console.log(`2. ✅ ${readyForAcceptance.length} pedidos LISTOS para que mensajeros acepten`);
    }

    const inProgress = ordersWithMessengers.filter(o => ['accepted', 'in_delivery'].includes(o.messenger_status));
    if (inProgress.length > 0) {
      console.log(`3. 🚚 ${inProgress.length} pedidos en progreso con mensajeros`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar
if (require.main === module) {
  debugMessengerOrderStates().then(() => {
    console.log('\n🏁 Análisis completado');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { debugMessengerOrderStates };
