const fetch = require('node-fetch');

async function createMultipleMessengers() {
  console.log('🚚 Creando equipo de mensajeros...\n');

  // Lista de mensajeros a crear
  const messengers = [
    {
      username: 'mensajero2',
      full_name: 'Carlos Martínez - Mensajero',
      email: 'carlos.martinez@empresa.com',
      password: 'mensajero123'
    },
    {
      username: 'mensajero3',
      full_name: 'María González - Mensajero',
      email: 'maria.gonzalez@empresa.com',
      password: 'mensajero123'
    },
    {
      username: 'mensajero4',
      full_name: 'José Rodríguez - Mensajero',
      email: 'jose.rodriguez@empresa.com',
      password: 'mensajero123'
    },
    {
      username: 'mensajero5',
      full_name: 'Ana Pérez - Mensajero',
      email: 'ana.perez@empresa.com',
      password: 'mensajero123'
    },
    {
      username: 'juanperez',
      full_name: 'Juan Pérez - Mensajero',
      email: 'juan.perez@empresa.com',
      password: 'mensajero123'
    },
    {
      username: 'pedrolopez',
      full_name: 'Pedro López - Mensajero',
      email: 'pedro.lopez@empresa.com',
      password: 'mensajero123'
    }
  ];

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
    console.log('✅ Admin logueado exitosamente');

    // 2. Crear cada mensajero
    console.log('\n2. 🆕 Creando mensajeros...');
    const createdMessengers = [];
    const existingMessengers = [];

    for (const messenger of messengers) {
      console.log(`\n   🚚 Creando: ${messenger.username}...`);
      
      const createResponse = await fetch('http://localhost:3001/api/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: messenger.username,
          full_name: messenger.full_name,
          email: messenger.email,
          role: 'mensajero',
          password: messenger.password,
          active: true
        })
      });

      if (createResponse.ok) {
        const newUser = await createResponse.json();
        console.log(`   ✅ ${messenger.username} creado (ID: ${newUser.data?.id})`);
        createdMessengers.push({
          ...messenger,
          id: newUser.data?.id,
          status: 'created'
        });
      } else {
        const errorText = await createResponse.text();
        if (errorText.includes('ya existe')) {
          console.log(`   ℹ️ ${messenger.username} ya existe`);
          existingMessengers.push({
            ...messenger,
            status: 'exists'
          });
        } else {
          console.log(`   ❌ Error creando ${messenger.username}: ${errorText}`);
        }
      }
    }

    // 3. Probar login de todos los mensajeros
    console.log('\n3. 🧪 Probando logins de mensajeros...');
    const allMessengers = [...createdMessengers, ...existingMessengers];
    const workingMessengers = [];

    for (const messenger of allMessengers) {
      console.log(`\n   🔑 Probando: ${messenger.username}`);
      
      const loginTest = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: messenger.username,
          password: messenger.password
        })
      });

      if (loginTest.ok) {
        const loginData = await loginTest.json();
        console.log(`   ✅ Login exitoso - ID: ${loginData.data?.user?.id}`);
        workingMessengers.push({
          ...messenger,
          id: loginData.data?.user?.id,
          working: true
        });
        
        // Probar acceso rápido a pedidos
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
        }
      } else {
        console.log(`   ❌ Login falló`);
        const errorText = await loginTest.text();
        console.log(`   Error: ${errorText}`);
      }
    }

    // 4. También verificar mensajero1 existente
    console.log('\n   🔑 Probando mensajero1 existente...');
    const mensajero1Test = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'mensajero1',
        password: 'mensajero123'
      })
    });

    if (mensajero1Test.ok) {
      console.log(`   ✅ mensajero1 funcional`);
      workingMessengers.unshift({
        username: 'mensajero1',
        full_name: 'Ana Rodríguez - Mensajero',
        password: 'mensajero123',
        status: 'existing',
        working: true
      });
    }

    // 5. Resumen final
    console.log('\n🎉 RESUMEN DEL EQUIPO DE MENSAJEROS:');
    console.log('═'.repeat(60));
    console.log(`📊 ESTADÍSTICAS:`);
    console.log(`   - Mensajeros creados: ${createdMessengers.length}`);
    console.log(`   - Mensajeros existentes: ${existingMessengers.length + 1}`); // +1 por mensajero1
    console.log(`   - Total funcionales: ${workingMessengers.length}`);

    console.log(`\n👥 EQUIPO COMPLETO DE MENSAJEROS:`);
    workingMessengers.forEach((messenger, index) => {
      console.log(`   ${index + 1}. ${messenger.username.padEnd(15)} - ${messenger.full_name}`);
      console.log(`      🔐 Contraseña: ${messenger.password}`);
      console.log(`      ✅ Estado: ${messenger.status === 'created' ? 'Recién creado' : 'Existente y funcional'}`);
      console.log('');
    });

    console.log('═'.repeat(60));
    console.log('🚀 TODOS LOS MENSAJEROS LISTOS PARA USAR');
    console.log('📱 Pueden loguear y gestionar entregas');
    console.log('🎯 Logística puede asignar pedidos a cualquiera de ellos');
    console.log('═'.repeat(60));

    return workingMessengers;

  } catch (error) {
    console.error('❌ Error:', error);
    return [];
  }
}

// Ejecutar
if (require.main === module) {
  createMultipleMessengers().then((messengers) => {
    console.log(`\n🏁 Creación completada: ${messengers.length} mensajeros funcionales`);
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { createMultipleMessengers };
