const fetch = require('node-fetch');

async function fixMessengerLoginAndTest() {
  console.log('🔧 Arreglando y probando login de mensajeros...\n');

  try {
    // 1. Login como admin para resetear contraseñas
    console.log('1. 🔐 Logueando como admin...');
    const adminLogin = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });
    
    const adminData = await adminLogin.json();
    const adminToken = adminData.data?.token;
    console.log('✅ Admin logueado');

    // 2. Resetear contraseñas de mensajeros a algo simple
    console.log('\n2. 🔄 Reseteando contraseñas de mensajeros...');
    
    const messengers = [
      { id: 15, username: 'mensajero1' },
      { id: 16, username: 'julian_carrillo' }
    ];

    for (const messenger of messengers) {
      try {
        const resetResponse = await fetch(`http://localhost:3001/api/users/${messenger.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            password: 'mensajero123'
          })
        });

        if (resetResponse.ok) {
          console.log(`✅ Contraseña reseteada para ${messenger.username}`);
        } else {
          console.log(`⚠️ Error reseteando contraseña para ${messenger.username}`);
        }
      } catch (error) {
        console.log(`❌ Error con ${messenger.username}:`, error.message);
      }
    }

    // 3. Probar login con mensajero1 (username sin caracteres especiales)
    console.log('\n3. 🧪 Probando login como mensajero1...');
    const messengerLogin = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'mensajero1',
        password: 'mensajero123'
      })
    });

    if (!messengerLogin.ok) {
      console.log('❌ Login como mensajero1 falló');
      const errorText = await messengerLogin.text();
      console.log('📄 Error:', errorText);
      return;
    }

    const messengerData = await messengerLogin.json();
    const messengerToken = messengerData.data?.token;
    
    console.log('✅ Login como mensajero exitoso');
    console.log('👤 Datos del mensajero:');
    console.log(`   - ID: ${messengerData.data.user.id}`);
    console.log(`   - Username: ${messengerData.data.user.username}`);
    console.log(`   - Nombre: ${messengerData.data.user.full_name}`);
    console.log(`   - Rol: ${messengerData.data.user.role}`);

    // 4. Obtener pedidos del mensajero
    console.log('\n4. 📦 Obteniendo pedidos del mensajero...');
    const ordersResponse = await fetch('http://localhost:3001/api/messenger/orders', {
      headers: {
        'Authorization': `Bearer ${messengerToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!ordersResponse.ok) {
      console.log(`❌ Error obteniendo pedidos: ${ordersResponse.status}`);
      const errorText = await ordersResponse.text();
      console.log('📄 Error:', errorText);
      return;
    }

    const ordersData = await ordersResponse.json();
    const messengerOrders = ordersData.data || ordersData;
    
    console.log(`✅ ${messengerOrders.length} pedidos obtenidos`);

    // 5. Análisis detallado
    console.log('\n5. 🎯 ANÁLISIS DETALLADO:');
    
    if (messengerOrders.length === 0) {
      console.log('⚠️ EL MENSAJERO NO VE NINGÚN PEDIDO');
      
      // Verificar si hay pedidos asignados desde perspectiva de admin
      console.log('\n🔍 Verificando desde admin qué pedidos están asignados...');
      const adminOrdersResponse = await fetch('http://localhost:3001/api/orders', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (adminOrdersResponse.ok) {
        const adminOrdersData = await adminOrdersResponse.json();
        const allOrders = adminOrdersData.data?.orders || [];
        const assignedToThisMessenger = allOrders.filter(o => o.assigned_messenger_id === messengerData.data.user.id);
        
        console.log(`📊 Total pedidos en sistema: ${allOrders.length}`);
        console.log(`📊 Pedidos asignados al mensajero ${messengerData.data.user.id}: ${assignedToThisMessenger.length}`);
        
        if (assignedToThisMessenger.length > 0) {
          console.log('\n🔍 Pedidos asignados pero no visibles al mensajero:');
          assignedToThisMessenger.forEach((order, index) => {
            console.log(`   ${index + 1}. ${order.order_number} - Estado: ${order.status} - Mensajero: ${order.messenger_status}`);
          });
          
          console.log('\n❌ PROBLEMA IDENTIFICADO:');
          console.log('   El mensajero tiene pedidos asignados pero no los ve.');
          console.log('   Esto indica un problema en el endpoint /api/messenger/orders');
        } else {
          console.log('\n✅ No hay pedidos asignados a este mensajero');
          console.log('   Esto explica por qué no ve opciones de aceptar');
        }
      }
      
      return;
    }

    // Análizar pedidos visibles
    messengerOrders.forEach((order, index) => {
      console.log(`\n${index + 1}. 📦 ${order.order_number}`);
      console.log(`   👤 Cliente: ${order.customer_name}`);
      console.log(`   📍 Estado: ${order.status}`);
      console.log(`   📱 Estado mensajero: ${order.messenger_status}`);
      console.log(`   🎯 OPCIONES FRONTEND:`);
      
      if (order.messenger_status === 'assigned') {
        console.log(`      ✅ [ACEPTAR] ❌ [RECHAZAR]`);
      } else if (order.messenger_status === 'accepted') {
        console.log(`      ▶️ [INICIAR ENTREGA]`);
      } else if (order.messenger_status === 'in_delivery') {
        console.log(`      📦 [ENTREGAR] ⚠️ [MARCAR FALLIDA]`);
      } else {
        console.log(`      👁️ [SOLO VER]`);
      }
    });

    // Resumen
    const assigned = messengerOrders.filter(o => o.messenger_status === 'assigned').length;
    const accepted = messengerOrders.filter(o => o.messenger_status === 'accepted').length;
    const inDelivery = messengerOrders.filter(o => o.messenger_status === 'in_delivery').length;

    console.log('\n6. 📊 RESUMEN FINAL:');
    console.log(`   📋 Total pedidos: ${messengerOrders.length}`);
    console.log(`   ✅ Para ACEPTAR: ${assigned}`);
    console.log(`   ▶️ Para INICIAR: ${accepted}`);
    console.log(`   📦 Para ENTREGAR: ${inDelivery}`);

    // Diagnóstico final
    console.log('\n7. 🎯 DIAGNÓSTICO FINAL:');
    
    if (assigned > 0) {
      console.log(`✅ ¡PROBLEMA RESUELTO! El mensajero tiene ${assigned} pedido(s) para aceptar`);
      console.log('   El botón de aceptar debería aparecer en el frontend');
    } else if (inDelivery > 0) {
      console.log(`📦 El mensajero tiene ${inDelivery} pedido(s) en entrega (por eso solo ve "entregar")`);
      console.log('   Para ver opciones de aceptar, necesita pedidos con messenger_status="assigned"');
    } else {
      console.log('⚠️ El mensajero no tiene pedidos para aceptar');
      console.log('   Necesita que logística le asigne pedidos nuevos');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar
if (require.main === module) {
  fixMessengerLoginAndTest().then(() => {
    console.log('\n🏁 Test completado');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { fixMessengerLoginAndTest };
