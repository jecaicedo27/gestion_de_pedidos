const fetch = require('node-fetch');

async function testExistingMessenger() {
  console.log('🧪 Probando mensajeros existentes...\n');

  const messengers = [
    { username: 'mensajero1', password: 'mensajero123' },
    { username: 'julian_carrillo', password: 'mensajero123' }
  ];

  for (const messenger of messengers) {
    console.log(`\n🚚 Probando: ${messenger.username}`);
    console.log('='.repeat(40));

    try {
      // Intentar login
      const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messenger)
      });

      if (loginResponse.ok) {
        const loginData = await loginResponse.json();
        console.log('✅ Login exitoso!');
        console.log(`   - User ID: ${loginData.data?.user?.id}`);
        console.log(`   - Role: ${loginData.data?.user?.role}`);
        console.log(`   - Full Name: ${loginData.data?.user?.full_name}`);

        // Probar acceso a pedidos
        const ordersResponse = await fetch('http://localhost:3001/api/orders', {
          headers: {
            'Authorization': `Bearer ${loginData.data.token}`,
            'Content-Type': 'application/json'
          }
        });

        if (ordersResponse.ok) {
          const orders = await ordersResponse.json();
          const ordersList = orders.data?.orders || orders.orders || [];
          console.log(`   📦 Pedidos accesibles: ${ordersList.length}`);
          
          if (ordersList.length > 0) {
            console.log('   📋 Primeros pedidos:');
            ordersList.slice(0, 2).forEach((order, index) => {
              console.log(`      ${index + 1}. ${order.order_number} - ${order.status}`);
            });
          }
        } else {
          console.log(`   ❌ Error acceso pedidos: ${ordersResponse.status}`);
        }

        // Probar endpoint específico de mensajero
        const messengerEndpointResponse = await fetch('http://localhost:3001/api/messenger/orders', {
          headers: {
            'Authorization': `Bearer ${loginData.data.token}`,
            'Content-Type': 'application/json'
          }
        });

        if (messengerEndpointResponse.ok) {
          console.log('   ✅ Endpoint mensajero: OK');
        } else {
          console.log(`   ⚠️ Endpoint mensajero: ${messengerEndpointResponse.status}`);
        }

        console.log('\n🎉 CREDENCIALES VÁLIDAS:');
        console.log(`   👤 Usuario: ${messenger.username}`);
        console.log(`   🔐 Contraseña: ${messenger.password}`);
        console.log('   ✅ Sistema funcional');

      } else {
        console.log('❌ Login falló');
        const errorText = await loginResponse.text();
        console.log(`   Error: ${errorText}`);
      }

    } catch (error) {
      console.log('❌ Error de conexión:', error.message);
    }
  }

  console.log('\n📋 RESUMEN DE USUARIOS MENSAJERO:');
  console.log('═'.repeat(50));
  console.log('Los siguientes usuarios están disponibles:');
  console.log('1. mensajero1 / mensajero123');
  console.log('2. julian_carrillo / mensajero123 (puede requerir reset)');
  console.log('═'.repeat(50));
}

// Ejecutar
if (require.main === module) {
  testExistingMessenger().then(() => {
    console.log('\n🏁 Prueba completada');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { testExistingMessenger };
