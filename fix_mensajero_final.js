const fetch = require('node-fetch');

async function fixMessengerFinal() {
  console.log('🔧 Fix FINAL para mensajero...\n');

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

    // 2. Buscar TODOS los usuarios mensajero
    console.log('\n2. 🔍 Buscando todos los usuarios mensajero...');
    
    const allUsersResponse = await fetch('http://localhost:3001/api/users', {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (allUsersResponse.ok) {
      const users = await allUsersResponse.json();
      const allUsers = users.data?.users || users.users || users;
      
      console.log('✅ Usuarios encontrados:');
      allUsers.forEach(user => {
        console.log(`   - ${user.id}: ${user.username} (${user.role}) - Active: ${user.active}`);
      });

      // 3. Encontrar usuario juliancarrillo o crear uno nuevo
      let targetUser = allUsers.find(u => u.username === 'juliancarrillo');
      
      if (targetUser) {
        console.log(`\n3. ✅ Usuario "juliancarrillo" encontrado (ID: ${targetUser.id})`);
        
        // Resetear completamente
        console.log('\n🔄 Reseteando usuario completamente...');
        const resetResponse = await fetch(`http://localhost:3001/api/users/${targetUser.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: 'juliancarrillo',
            full_name: 'Julian Carrillo - Mensajero',
            email: 'julian.carrillo@empresa.com',
            role: 'mensajero',
            password: 'mensajero123',
            active: 1
          })
        });

        if (resetResponse.ok) {
          console.log('✅ Usuario reseteado exitosamente');
        } else {
          const errorText = await resetResponse.text();
          console.log('❌ Error reseteando:', errorText);
        }
        
      } else {
        console.log('\n3. ⚠️ Usuario "juliancarrillo" no encontrado');
        
        // Crear username alternativo
        const newUsername = 'mensajero1';
        console.log(`\n🆕 Creando mensajero "${newUsername}"...`);
        
        const createResponse = await fetch('http://localhost:3001/api/users', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: newUsername,
            full_name: 'Julian Carrillo - Mensajero',
            email: 'mensajero1@empresa.com',
            role: 'mensajero',
            password: 'mensajero123',
            active: true
          })
        });

        if (createResponse.ok) {
          const newUser = await createResponse.json();
          console.log(`✅ Usuario "${newUsername}" creado exitosamente`);
          targetUser = { username: newUsername, id: newUser.data?.id };
        } else {
          const errorText = await createResponse.text();
          console.log('❌ Error creando:', errorText);
          return;
        }
      }

      // 4. Probar login
      console.log(`\n4. 🧪 Probando login de "${targetUser.username}"...`);
      const loginTest = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: targetUser.username,
          password: 'mensajero123'
        })
      });

      if (loginTest.ok) {
        const loginData = await loginTest.json();
        console.log('✅ Login exitoso!');
        console.log(`   - User ID: ${loginData.data?.user?.id}`);
        console.log(`   - Role: ${loginData.data?.user?.role}`);
        console.log(`   - Full Name: ${loginData.data?.user?.full_name}`);

        // 5. Probar acceso a pedidos
        console.log('\n5. 📦 Probando acceso a pedidos...');
        const ordersResponse = await fetch('http://localhost:3001/api/orders', {
          headers: {
            'Authorization': `Bearer ${loginData.data.token}`,
            'Content-Type': 'application/json'
          }
        });

        if (ordersResponse.ok) {
          const orders = await ordersResponse.json();
          const ordersList = orders.data?.orders || orders.orders || [];
          console.log(`✅ Acceso a pedidos: ${ordersList.length} pedidos encontrados`);
          
          if (ordersList.length > 0) {
            console.log('\n📋 Pedidos disponibles para mensajero:');
            ordersList.slice(0, 3).forEach((order, index) => {
              console.log(`   ${index + 1}. ${order.order_number} - ${order.status} - ${order.customer_name}`);
            });
          } else {
            console.log('ℹ️ No hay pedidos asignados al mensajero actualmente');
          }
        } else {
          console.log(`❌ Error acceso pedidos: ${ordersResponse.status}`);
        }

        console.log('\n🎉 CREDENCIALES FINALES:');
        console.log('═'.repeat(50));
        console.log(`👤 Usuario: ${targetUser.username}`);
        console.log('🔐 Contraseña: mensajero123');
        console.log('🏷️ Rol: mensajero');
        console.log('✅ Estado: Login funcional');
        console.log('📱 Puede acceder al sistema');
        console.log('═'.repeat(50));

      } else {
        console.log(`❌ Login falló: ${loginTest.status}`);
        const errorText = await loginTest.text();
        console.log('Error:', errorText);
        
        // Intentar con otro usuario mensajero existente
        const existingMessenger = allUsers.find(u => u.role === 'mensajero' && u.active);
        if (existingMessenger) {
          console.log(`\n⚡ ALTERNATIVA: Usar mensajero existente "${existingMessenger.username}"`);
          console.log(`   - ID: ${existingMessenger.id}`);
          console.log(`   - Nombre: ${existingMessenger.full_name}`);
          console.log('   - Puedes intentar reseteando su contraseña desde admin');
        }
      }

    } else {
      console.log('❌ Error obteniendo usuarios');
      return;
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar
if (require.main === module) {
  fixMessengerFinal().then(() => {
    console.log('\n🏁 Fix final completado');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { fixMessengerFinal };
