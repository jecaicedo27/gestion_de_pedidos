const fetch = require('node-fetch');

async function createMessenger() {
  console.log('🚚 Creando mensajero con username válido...\n');

  try {
    // 1. Login como admin
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

    // 2. Crear nuevo mensajero con username alfanumérico
    console.log('\n2. 🆕 Creando mensajero "juliancarrillo"...');
    const createResponse = await fetch('http://localhost:3001/api/users', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'juliancarrillo',
        full_name: 'Julian Carrillo',
        email: 'julian.carrillo@empresa.com',
        role: 'mensajero',
        password: 'mensajero123',
        active: true
      })
    });

    if (createResponse.ok) {
      const newUser = await createResponse.json();
      console.log('✅ Usuario "juliancarrillo" creado exitosamente');
      console.log(`   - ID: ${newUser.data?.id || 'N/A'}`);
      console.log(`   - Username: juliancarrillo`);
      console.log(`   - Role: mensajero`);
    } else {
      const errorData = await createResponse.text();
      console.log('⚠️ Usuario ya existe o error:', errorData);
    }

    // 3. Probar login del nuevo mensajero
    console.log('\n3. 🧪 Probando login de "juliancarrillo"...');
    const messengerLogin = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'juliancarrillo',
        password: 'mensajero123'
      })
    });

    if (messengerLogin.ok) {
      const messengerData = await messengerLogin.json();
      console.log('✅ Login de "juliancarrillo" exitoso');
      console.log('📋 Datos del login:');
      console.log(`   - Token: ${messengerData.data?.token ? 'Generado' : 'No generado'}`);
      console.log(`   - User ID: ${messengerData.data?.user?.id}`);
      console.log(`   - Role: ${messengerData.data?.user?.role}`);
      console.log(`   - Full Name: ${messengerData.data?.user?.full_name}`);

      // 4. Probar acceso a pedidos
      console.log('\n4. 📦 Probando acceso a pedidos...');
      const ordersResponse = await fetch('http://localhost:3001/api/orders', {
        headers: {
          'Authorization': `Bearer ${messengerData.data.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (ordersResponse.ok) {
        const orders = await ordersResponse.json();
        const ordersList = orders.data?.orders || orders.orders || [];
        console.log(`✅ Acceso exitoso: ${ordersList.length} pedidos encontrados`);
        
        if (ordersList.length > 0) {
          console.log('\n📋 Pedidos para mensajero:');
          ordersList.slice(0, 5).forEach((order, index) => {
            console.log(`   ${index + 1}. ${order.order_number} - ${order.status} - ${order.customer_name}`);
          });
        }
      } else {
        console.log(`❌ Error accediendo a pedidos: ${ordersResponse.status}`);
        const errorText = await ordersResponse.text();
        console.log('Error:', errorText);
      }

      // 5. Probar endpoint específico de mensajero
      console.log('\n5. 🚚 Probando endpoint de mensajero...');
      const messengerEndpointResponse = await fetch('http://localhost:3001/api/messenger/orders', {
        headers: {
          'Authorization': `Bearer ${messengerData.data.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (messengerEndpointResponse.ok) {
        const messengerOrders = await messengerEndpointResponse.json();
        console.log(`✅ Endpoint de mensajero funcionando`);
        console.log(`📋 Pedidos disponibles: ${messengerOrders.data?.length || 0}`);
      } else {
        console.log(`⚠️ Endpoint de mensajero: ${messengerEndpointResponse.status}`);
        const errorText = await messengerEndpointResponse.text();
        console.log('Info:', errorText);
      }

    } else {
      console.log(`❌ Login falló: ${messengerLogin.status}`);
      const errorText = await messengerLogin.text();
      console.log('Error:', errorText);
    }

    console.log('\n🎉 CREDENCIALES FINALES:');
    console.log('═══════════════════════════════════');
    console.log('👤 Usuario: juliancarrillo');
    console.log('🔐 Contraseña: mensajero123');
    console.log('🏷️ Rol: mensajero');
    console.log('✅ Estado: Activo');
    console.log('═══════════════════════════════════');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar
if (require.main === module) {
  createMessenger().then(() => {
    console.log('\n🏁 Proceso completado');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { createMessenger };
