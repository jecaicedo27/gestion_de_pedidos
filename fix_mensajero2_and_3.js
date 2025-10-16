const fetch = require('node-fetch');

async function fixMessengers2And3() {
  console.log('🔧 Arreglando mensajero2 y mensajero3...\n');

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

    if (!adminLogin.ok) {
      console.log('❌ Error login admin');
      return [];
    }

    const adminData = await adminLogin.json();
    const adminToken = adminData.data?.token;
    console.log('✅ Admin logueado exitosamente');

    // 2. Verificar mensajero1 que ya funciona
    console.log('\n2. ✅ Confirmando mensajero1...');
    const mensajero1Test = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'mensajero1',
        password: 'mensajero123'
      })
    });

    if (mensajero1Test.ok) {
      console.log('   ✅ mensajero1 funciona correctamente');
    } else {
      console.log('   ❌ mensajero1 falló inesperadamente');
    }

    // 3. Obtener todos los usuarios
    console.log('\n3. 🔍 Obteniendo lista de usuarios...');
    const usersResponse = await fetch('http://localhost:3001/api/users', {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!usersResponse.ok) {
      console.log('❌ Error obteniendo usuarios');
      return [];
    }

    const users = await usersResponse.json();
    const allUsers = users.data?.users || users.users || [];
    
    console.log('✅ Usuarios encontrados:');
    allUsers.forEach(user => {
      console.log(`   - ${user.id}: ${user.username} (${user.role}) - Active: ${user.active}`);
    });

    // 4. Arreglar mensajero2 y mensajero3
    const problemMessengers = ['mensajero2', 'mensajero3'];
    const fixedMessengers = [];

    for (const username of problemMessengers) {
      console.log(`\n🔨 ARREGLANDO: ${username}`);
      console.log('═'.repeat(40));
      
      // Buscar si existe
      const existingUser = allUsers.find(u => u.username === username);
      
      if (existingUser) {
        console.log(`   📋 Usuario existe (ID: ${existingUser.id})`);
        console.log(`   📋 Role actual: ${existingUser.role}`);
        console.log(`   📋 Active actual: ${existingUser.active}`);
        
        // Resetear completamente
        console.log('   🔄 Reseteando usuario...');
        const resetResponse = await fetch(`http://localhost:3001/api/users/${existingUser.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: username,
            full_name: `${username.charAt(0).toUpperCase() + username.slice(1)} - Mensajero`,
            email: `${username}@empresa.com`,
            role: 'mensajero',
            password: 'mensajero123',
            active: true
          })
        });

        if (resetResponse.ok) {
          console.log(`   ✅ ${username} reseteado exitosamente`);
        } else {
          const errorText = await resetResponse.text();
          console.log(`   ❌ Error reseteando: ${errorText}`);
        }
        
      } else {
        console.log(`   📋 Usuario NO existe, creando...`);
        
        // Crear nuevo usuario
        const createResponse = await fetch('http://localhost:3001/api/users', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: username,
            full_name: `${username.charAt(0).toUpperCase() + username.slice(1)} - Mensajero`,
            email: `${username}@empresa.com`,
            role: 'mensajero',
            password: 'mensajero123',
            active: true
          })
        });

        if (createResponse.ok) {
          console.log(`   ✅ ${username} creado exitosamente`);
        } else {
          const errorText = await createResponse.text();
          console.log(`   ❌ Error creando: ${errorText}`);
        }
      }

      // 5. Probar login inmediatamente
      console.log(`   🧪 Probando login de ${username}...`);
      const loginTest = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username,
          password: 'mensajero123'
        })
      });

      if (loginTest.ok) {
        const loginData = await loginTest.json();
        console.log(`   🎉 ${username} LOGIN EXITOSO!`);
        console.log(`   📋 User ID: ${loginData.data?.user?.id}`);
        console.log(`   📋 Role: ${loginData.data?.user?.role}`);
        
        fixedMessengers.push({
          username: username,
          id: loginData.data?.user?.id,
          status: 'fixed'
        });

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
          console.log(`   📦 Acceso a pedidos: ${ordersList.length} pedidos disponibles`);
        }
        
      } else {
        console.log(`   ❌ ${username} login falló`);
        const errorText = await loginTest.text();
        console.log(`   📋 Error: ${errorText}`);
      }
    }

    // 6. Resumen final
    console.log('\n🎉 RESUMEN FINAL:');
    console.log('═'.repeat(60));
    console.log(`📊 Total mensajeros arreglados: ${fixedMessengers.length}/2`);
    
    console.log('\n🚚 EQUIPO DE MENSAJEROS ACTUALIZADO:');
    
    // Verificar los 3 mensajeros principales
    const allMessengers = ['mensajero1', 'mensajero2', 'mensajero3'];
    
    for (const username of allMessengers) {
      const testResponse = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username,
          password: 'mensajero123'
        })
      });

      if (testResponse.ok) {
        console.log(`   ✅ ${username.padEnd(15)} - 🔐 mensajero123 - ✅ FUNCIONAL`);
      } else {
        console.log(`   ❌ ${username.padEnd(15)} - 🔐 mensajero123 - ❌ NO FUNCIONA`);
      }
    }

    console.log('\n═'.repeat(60));
    console.log('🎯 INSTRUCCIONES FINALES:');
    console.log('1. Todos los mensajeros usan contraseña: mensajero123');
    console.log('2. Ya pueden loguear en http://localhost:3000');
    console.log('3. Pueden ver y aceptar pedidos asignados');
    console.log('4. Logística puede asignarles entregas');
    console.log('═'.repeat(60));

    return fixedMessengers;

  } catch (error) {
    console.error('❌ Error crítico:', error.message);
    return [];
  }
}

// Ejecutar
if (require.main === module) {
  fixMessengers2And3().then((messengers) => {
    console.log(`\n🏁 Proceso completado: ${messengers.length} mensajeros arreglados`);
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error final:', error);
    process.exit(1);
  });
}

module.exports = { fixMessengers2And3 };
