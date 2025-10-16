const fetch = require('node-fetch');

async function testAdminMessengerFix() {
  console.log('🧪 Probando fix de columna MENSAJERO para admin...\n');

  try {
    // 1. Obtener token de admin
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
      console.log('❌ No se pudo obtener token de admin');
      return;
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.data?.token;
    console.log('✅ Token obtenido correctamente');
    console.log('🔐 Token:', token ? token.substring(0, 50) + '...' : 'NULL');

    if (!token) {
      console.log('❌ No se pudo obtener token válido');
      console.log('📋 Respuesta del login:', JSON.stringify(loginData, null, 2));
      return;
    }

    // 2. Probar endpoint /api/orders con filtro in_delivery (más común)
    console.log('\n2. 📡 Probando endpoint /api/orders?status=in_delivery...');
    const ordersResponse = await fetch('http://localhost:3001/api/orders?status=in_delivery', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!ordersResponse.ok) {
      console.log(`❌ Error en endpoint: ${ordersResponse.status} ${ordersResponse.statusText}`);
      return;
    }
    
    const ordersData = await ordersResponse.json();
    const orders = ordersData.data?.orders || [];
    
    console.log(`📦 Respuesta del endpoint: ${orders.length} pedidos encontrados`);

    // 3. Verificar que los datos de mensajeros están incluidos
    console.log('\n3. ✅ VERIFICANDO DATOS DE MENSAJEROS:');
    
    let messengersFound = 0;
    let messengersWithNames = 0;
    
    orders.forEach((order, index) => {
      console.log(`\n${index + 1}. 📦 ${order.order_number}`);
      console.log(`   👤 Cliente: ${order.customer_name}`);
      console.log(`   📍 Estado: ${order.status}`);
      console.log(`   👨‍💼 assigned_messenger_id: ${order.assigned_messenger_id || 'NULL'}`);
      console.log(`   📱 messenger_status: ${order.messenger_status || 'NULL'}`);
      console.log(`   👤 assigned_messenger_name: ${order.assigned_messenger_name || 'NULL'}`);
      console.log(`   👨‍💼 messenger_name: ${order.messenger_name || 'NULL'}`);
      
      if (order.assigned_messenger_id) {
        messengersFound++;
        if (order.messenger_name || order.assigned_messenger_name) {
          messengersWithNames++;
        }
      }
    });

    // 4. Resultados del test
    console.log('\n4. 📊 RESULTADOS DEL TEST:');
    console.log(`   📦 Total de pedidos: ${orders.length}`);
    console.log(`   👨‍💼 Pedidos con mensajero asignado: ${messengersFound}`);
    console.log(`   📛 Pedidos con nombres de mensajero: ${messengersWithNames}`);
    
    // 5. Evaluación final
    console.log('\n5. 🎯 EVALUACIÓN:');
    
    if (orders.length === 0) {
      console.log('⚠️ No hay pedidos en estado "en_reparto" para probar');
    } else if (messengersFound === 0) {
      console.log('❌ PROBLEMA: Los pedidos no tienen mensajeros asignados');
    } else if (messengersWithNames < messengersFound) {
      console.log('❌ PROBLEMA: Los nombres de mensajeros no se están devolviendo correctamente');
    } else {
      console.log('✅ ¡ÉXITO! Los datos de mensajeros se están devolviendo correctamente');
      console.log('📱 El frontend ahora debería mostrar los nombres en la columna MENSAJERO');
    }

    // 6. Instrucciones para el usuario
    console.log('\n6. 📋 INSTRUCCIONES PARA VERIFICAR:');
    console.log('   1. Recarga la página de admin en el navegador (F5)');
    console.log('   2. Ve a la vista con filtro "En Reparto"');
    console.log('   3. La columna MENSAJERO debería mostrar nombres reales');
    console.log('   4. Si sigue mostrando "-", revisa la consola del navegador para errores');

  } catch (error) {
    console.error('❌ Error en el test:', error);
  }
}

// Ejecutar
if (require.main === module) {
  testAdminMessengerFix().then(() => {
    console.log('\n🏁 Test completado');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { testAdminMessengerFix };
