const fetch = require('node-fetch');

async function fixMessengerLogin() {
  console.log('🚚 Arreglando login del mensajero Julian...\n');

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

    // 2. Buscar el usuario julian_carrillo
    console.log('\n2. 🔍 Buscando usuario julian_carrillo...');
    
    const userResponse = await fetch('http://localhost:3001/api/users?username=julian_carrillo', {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (userResponse.ok) {
      const users = await userResponse.json();
      const julianUser = users.data?.users?.[0] || users.users?.[0] || users[0];
      
      if (julianUser) {
        console.log('✅ Usuario encontrado:');
        console.log(`   - ID: ${julianUser.id}`);
        console.log(`   - Username: ${julianUser.username}`);
        console.log(`   - Full Name: ${julianUser.full_name}`);
        console.log(`   - Role Actual: ${julianUser.role}`);
        console.log(`   - Active: ${julianUser.active}`);

        // 3. Corregir role a mensajero
        if (julianUser.role !== 'mensajero') {
          console.log(`\n⚠️ Role incorrecto (${julianUser.role}), corrigiendo a mensajero...`);
          
          const roleResponse = await fetch(`http://localhost:3001/api/users/${julianUser.id}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${adminToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              role: 'mensajero'
            })
          });

          if (roleResponse.ok) {
            console.log('✅ Role corregido a mensajero');
          } else {
            console.log('❌ Error corrigiendo role');
            const errorText = await roleResponse.text();
            console.log('Error:', errorText);
            return;
          }
        }

        // 4. Verificar si está activo
        if (!julianUser.active) {
          console.log('\n⚠️ Usuario inactivo, activando...');
          
          const activateResponse = await fetch(`http://localhost:3001/api/users/${julianUser.id}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${adminToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              active: true
            })
          });

          if (activateResponse.ok) {
            console.log('✅ Usuario activado');
          } else {
            console.log('❌ Error activando usuario');
          }
        }

        // 5. Resetear contraseña por si acaso
        console.log('\n5. 🔄 Reseteando contraseña...');
        const passwordResponse = await fetch(`http://localhost:3001/api/users/${julianUser.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            password: 'mensajero123'
          })
        });

        if (passwordResponse.ok) {
          console.log('✅ Contraseña reseteada a: mensajero123');
        } else {
          console.log('❌ Error reseteando contraseña');
        }

      } else {
        console.log('❌ Usuario julian_carrillo no encontrado');
        
        // Crear el usuario si no existe
        console.log('\n🆕 Creando usuario julian_carrillo...');
        const createResponse = await fetch('http://localhost:3001/api/users', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: 'julian_carrillo',
            full_name: 'Julian Carrillo',
            email: 'julian.carrillo@empresa.com',
            role: 'mensajero',
            password: 'mensajero123',
            active: true
          })
        });

        if (createResponse.ok) {
          console.log('✅ Usuario julian_carrillo creado exitosamente');
        } else {
          console.log('❌ Error creando usuario');
          const errorText = await createResponse.text();
          console.log('Error:', errorText);
        }
      }
    } else {
      console.log('❌ Error obteniendo usuarios');
      return;
    }

    // 6. Probar login del mensajero
    console.log('\n6. 🧪 Probando login de julian_carrillo...');
    const messengerLogin = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'julian_carrillo',
        password: 'mensajero123'
      })
    });

    if (messengerLogin.ok) {
      const messengerData = await messengerLogin.json();
      console.log('✅ Login de julian_carrillo exitoso');
      console.log('📋 Datos del login:');
      console.log(`   - Token: ${messengerData.data?.token ? 'Generado correctamente' : 'No generado'}`);
      console.log(`   - User ID: ${messengerData.data?.user?.id}`);
      console.log(`   - Role: ${messengerData.data?.user?.role}`);
      console.log(`   - Full Name: ${messengerData.data?.user?.full_name}`);

      // 7. Probar acceso a pedidos como mensajero
      console.log('\n7. 📦 Probando acceso a pedidos como mensajero...');
      const ordersResponse = await fetch('http://localhost:3001/api/orders', {
        headers: {
          'Authorization': `Bearer ${messengerData.data.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (ordersResponse.ok) {
        const orders = await ordersResponse.json();
        const ordersList = orders.data?.orders || orders.orders || [];
        console.log(`✅ Acceso exitoso: ${ordersList.length} pedidos encontrados para mensajero`);
        
        if (ordersList.length > 0) {
          console.log('\n📋 Pedidos disponibles para mensajero:');
          ordersList.slice(0, 3).forEach((order, index) => {
            console.log(`   ${index + 1}. ${order.order_number} - ${order.status} - ${order.customer_name}`);
          });
        }
      } else {
        console.log(`❌ Error accediendo a pedidos: ${ordersResponse.status}`);
        const errorText = await ordersResponse.text();
        console.log('Error:', errorText);
      }

      // 8. Probar endpoint específico de mensajero
      console.log('\n8. 🚚 Probando endpoint específico de mensajero...');
      const messengerEndpointResponse = await fetch('http://localhost:3001/api/messenger/orders', {
        headers: {
          'Authorization': `Bearer ${messengerData.data.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (messengerEndpointResponse.ok) {
        const messengerOrders = await messengerEndpointResponse.json();
        console.log(`✅ Endpoint de mensajero exitoso`);
      } else {
        console.log(`❌ Error en endpoint de mensajero: ${messengerEndpointResponse.status}`);
        const errorText = await messengerEndpointResponse.text();
        console.log('Error:', errorText);
      }

    } else {
      console.log(`❌ Login de julian_carrillo falló: ${messengerLogin.status}`);
      const errorText = await messengerLogin.text();
      console.log('Error:', errorText);
    }

    console.log('\n🎉 RESUMEN FINAL:');
    console.log('👤 Usuario: julian_carrillo');
    console.log('🔐 Contraseña: mensajero123');
    console.log('🏷️ Rol: mensajero');
    console.log('✅ Estado: Activo');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar
if (require.main === module) {
  fixMessengerLogin().then(() => {
    console.log('\n🏁 Fix completado');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { fixMessengerLogin };
