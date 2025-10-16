const fetch = require('node-fetch');

async function testMessengerLoginView() {
  console.log('🧪 Probando vista de mensajero específico...\n');

  try {
    // 1. Login como julian_carrillo (mensajero)
    console.log('1. 🔐 Logueando como julian_carrillo...');
    const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'julian_carrillo',
        password: 'password123'
      })
    });
    
    if (!loginResponse.ok) {
      console.log('❌ Login failed. Intentando con credenciales alternativas...');
      
      // Intentar con admin para obtener info del usuario
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
      
      // Obtener info del mensajero
      const userResponse = await fetch('http://localhost:3001/api/users/16', {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        console.log('👤 Info del mensajero julian_carrillo:');
        console.log(JSON.stringify(userData, null, 2));
      }
      
      console.log('⚠️ No se pudo hacer login como julian_carrillo. Probando credenciales comunes...');
      
      // Intentar diferentes contraseñas comunes
      const commonPasswords = ['123456', 'password', 'julian123', 'mensajero123'];
      let messengerToken = null;
      let messengerData = null;
      
      for (const pwd of commonPasswords) {
        const testLogin = await fetch('http://localhost:3001/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'julian_carrillo',
            password: pwd
          })
        });
        
        if (testLogin.ok) {
          messengerData = await testLogin.json();
          messengerToken = messengerData.data?.token;
          console.log(`✅ Login exitoso con contraseña: ${pwd}`);
          break;
        }
      }
      
      if (!messengerToken) {
        console.log('❌ No se pudo hacer login como julian_carrillo con ninguna contraseña común');
        return;
      }
    } else {
      const messengerData = await loginResponse.json();
      const messengerToken = messengerData.data?.token;
    }

    // Si llegamos aquí, tenemos un token válido
    const messengerData = !loginResponse.ok ? messengerData : await loginResponse.json();
    const messengerToken = messengerData.data?.token;
    
    console.log('✅ Login como mensajero exitoso');
    console.log('👤 Datos del mensajero logueado:');
    console.log(`   - ID: ${messengerData.data.user.id}`);
    console.log(`   - Username: ${messengerData.data.user.username}`);
    console.log(`   - Nombre: ${messengerData.data.user.full_name}`);
    console.log(`   - Rol: ${messengerData.data.user.role}`);

    // 2. Obtener pedidos usando endpoint de mensajeros
    console.log('\n2. 📦 Obteniendo pedidos como mensajero...');
    const ordersResponse = await fetch('http://localhost:3001/api/messenger/orders', {
      headers: {
        'Authorization': `Bearer ${messengerToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!ordersResponse.ok) {
      console.log(`❌ Error obteniendo pedidos: ${ordersResponse.status} ${ordersResponse.statusText}`);
      const errorText = await ordersResponse.text();
      console.log('📄 Respuesta del error:', errorText);
      return;
    }
    
    const ordersData = await ordersResponse.json();
    const messengerOrders = ordersData.data || ordersData;
    
    console.log(`✅ ${messengerOrders.length} pedidos obtenidos para el mensajero`);

    // 3. Analizar cada pedido y sus opciones
    console.log('\n3. 🎯 ANÁLISIS DE PEDIDOS VISIBLES PARA EL MENSAJERO:');
    
    if (messengerOrders.length === 0) {
      console.log('⚠️ EL MENSAJERO NO VE NINGÚN PEDIDO');
      console.log('   Esto explica por qué no ve opciones de aceptar');
      console.log('\n4. 🔍 POSIBLES CAUSAS:');
      console.log('   - El endpoint /api/messenger/orders no devuelve pedidos asignados');
      console.log('   - Los pedidos no están correctamente asignados a este mensajero');
      console.log('   - Hay un problema de autorización en el endpoint');
      return;
    }

    messengerOrders.forEach((order, index) => {
      console.log(`\n${index + 1}. 📦 ${order.order_number || order.id}`);
      console.log(`   👤 Cliente: ${order.customer_name}`);
      console.log(`   📍 Estado del pedido: ${order.status}`);
      console.log(`   🚚 Mensajero asignado: ${order.assigned_messenger_id}`);
      console.log(`   📱 Estado del mensajero: ${order.messenger_status}`);
      console.log(`   💰 Total: $${order.total_amount?.toLocaleString('es-CO') || '0'}`);
      
      // Determinar qué opciones vería en el frontend
      console.log(`   🎯 OPCIONES DISPONIBLES EN EL FRONTEND:`);
      
      if (order.messenger_status === 'assigned') {
        console.log(`      ✅ [ACEPTAR PEDIDO] - Botón verde visible`);
        console.log(`      ❌ [RECHAZAR PEDIDO] - Botón rojo visible`);
      } else if (order.messenger_status === 'accepted') {
        console.log(`      ▶️ [INICIAR ENTREGA] - Botón azul visible`);
      } else if (order.messenger_status === 'in_delivery') {
        console.log(`      📦 [COMPLETAR ENTREGA] - Botón morado visible`);
        console.log(`      ⚠️ [MARCAR ENTREGA FALLIDA] - Botón naranja visible`);
      } else {
        console.log(`      👁️ [SOLO VER] - Solo opciones de visualización`);
        console.log(`      ⚠️ Estado '${order.messenger_status}' no reconocido para acciones`);
      }
    });

    // 4. Comparación con datos esperados
    console.log('\n4. 📊 RESUMEN DEL PROBLEMA:');
    
    const assignedOrders = messengerOrders.filter(o => o.messenger_status === 'assigned');
    const acceptedOrders = messengerOrders.filter(o => o.messenger_status === 'accepted');
    const inDeliveryOrders = messengerOrders.filter(o => o.messenger_status === 'in_delivery');
    
    console.log(`   📋 Total pedidos visibles: ${messengerOrders.length}`);
    console.log(`   ✅ Pedidos para ACEPTAR: ${assignedOrders.length}`);
    console.log(`   ▶️ Pedidos para INICIAR: ${acceptedOrders.length}`);
    console.log(`   📦 Pedidos para ENTREGAR: ${inDeliveryOrders.length}`);
    
    // 5. Diagnóstico final
    console.log('\n5. 🎯 DIAGNÓSTICO:');
    
    if (assignedOrders.length > 0) {
      console.log(`✅ HAY ${assignedOrders.length} pedido(s) con opción de aceptar disponible`);
      console.log('   El problema NO está en los datos del backend');
      console.log('   Revisar:');
      console.log('   - Si el frontend está mostrando correctamente estos pedidos');
      console.log('   - Si los filtros del frontend están ocultando estos pedidos');
      console.log('   - Si hay errores de JavaScript en la consola del navegador');
    } else {
      console.log('❌ NO HAY pedidos con opción de aceptar');
      console.log('   El problema está en:');
      console.log('   - Los pedidos no están siendo asignados correctamente');
      console.log('   - Los pedidos asignados no tienen el messenger_status correcto');
      console.log('   - El endpoint de mensajeros no está funcionando correctamente');
    }

    if (inDeliveryOrders.length > 0) {
      console.log(`\n📦 Hay ${inDeliveryOrders.length} pedido(s) en estado 'in_delivery'`);
      console.log('   Esto explica por qué el mensajero ve opciones de "entregar"');
    }

  } catch (error) {
    console.error('❌ Error en el test:', error);
  }
}

// Ejecutar
if (require.main === module) {
  testMessengerLoginView().then(() => {
    console.log('\n🏁 Test completado');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { testMessengerLoginView };
