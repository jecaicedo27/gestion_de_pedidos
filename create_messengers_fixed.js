const fetch = require('node-fetch');

async function createMessengersFixed() {
  console.log('🚚 Creando equipo de mensajeros (versión corregida)...\n');

  // Lista de mensajeros a crear
  const messengers = [
    { username: 'mensajero2', name: 'Carlos Martínez', email: 'carlos@empresa.com' },
    { username: 'mensajero3', name: 'María González', email: 'maria@empresa.com' },
    { username: 'mensajero4', name: 'José Rodríguez', email: 'jose@empresa.com' },
    { username: 'juanperez', name: 'Juan Pérez', email: 'juan@empresa.com' },
    { username: 'carloslopez', name: 'Carlos López', email: 'carlos.l@empresa.com' },
    { username: 'anagarcia', name: 'Ana García', email: 'ana.g@empresa.com' }
  ];

  const allMessengers = [];
  const password = 'mensajero123';

  try {
    for (const messenger of messengers) {
      console.log(`\n🔑 Procesando: ${messenger.username}...`);
      
      // Nuevo login para cada usuario (para evitar tokens vencidos)
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
        continue;
      }

      const adminData = await adminLogin.json();
      const adminToken = adminData.data?.token;

      // Intentar crear el usuario
      const createResponse = await fetch('http://localhost:3001/api/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: messenger.username,
          full_name: `${messenger.name} - Mensajero`,
          email: messenger.email,
          role: 'mensajero',
          password: password,
          active: true
        })
      });

      if (createResponse.ok) {
        console.log(`   ✅ ${messenger.username} creado exitosamente`);
        
        // Probar login inmediatamente
        const testLogin = await fetch('http://localhost:3001/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: messenger.username,
            password: password
          })
        });

        if (testLogin.ok) {
          console.log(`   🎉 Login funcionando para ${messenger.username}`);
          allMessengers.push({
            username: messenger.username,
            fullName: `${messenger.name} - Mensajero`,
            password: password,
            status: 'created'
          });
        } else {
          console.log(`   ⚠️ Usuario creado pero login falló`);
        }

      } else {
        const errorText = await createResponse.text();
        if (errorText.includes('ya existe')) {
          console.log(`   ℹ️ ${messenger.username} ya existe, verificando login...`);
          
          // Probar login con usuario existente
          const testLogin = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: messenger.username,
              password: password
            })
          });

          if (testLogin.ok) {
            console.log(`   ✅ Login funcional para ${messenger.username} existente`);
            allMessengers.push({
              username: messenger.username,
              fullName: `${messenger.name} - Mensajero`,
              password: password,
              status: 'existing'
            });
          } else {
            console.log(`   ❌ Usuario existe pero login no funciona`);
          }
        } else {
          console.log(`   ❌ Error: ${errorText}`);
        }
      }

      // Pequeña pausa entre usuarios
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Verificar mensajero1 existente
    console.log(`\n🔑 Verificando mensajero1 existente...`);
    const mensajero1Test = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'mensajero1',
        password: password
      })
    });

    if (mensajero1Test.ok) {
      console.log(`   ✅ mensajero1 funcional`);
      allMessengers.unshift({
        username: 'mensajero1',
        fullName: 'Ana Rodríguez - Mensajero',
        password: password,
        status: 'existing'
      });
    }

    // Resumen final
    console.log('\n🎉 EQUIPO DE MENSAJEROS COMPLETO:');
    console.log('═'.repeat(70));
    console.log(`📊 Total mensajeros funcionales: ${allMessengers.length}`);
    console.log('\n👥 LISTA COMPLETA:');
    
    allMessengers.forEach((messenger, index) => {
      console.log(`   ${(index + 1).toString().padStart(2)}. ${messenger.username.padEnd(15)} - ${messenger.fullName}`);
      console.log(`       🔐 Contraseña: ${messenger.password}`);
      console.log(`       📱 Estado: ${messenger.status === 'created' ? 'Recién creado' : 'Existente y funcional'}`);
      console.log('');
    });

    console.log('═'.repeat(70));
    console.log('🚀 TODOS LISTOS PARA USAR');
    console.log('📦 Pueden recibir asignaciones de pedidos');
    console.log('🎯 Logística puede distribuir trabajo entre el equipo');
    console.log('═'.repeat(70));

    return allMessengers;

  } catch (error) {
    console.error('❌ Error general:', error);
    return allMessengers;
  }
}

// Ejecutar
if (require.main === module) {
  createMessengersFixed().then((messengers) => {
    console.log(`\n🏁 Proceso completado: ${messengers.length} mensajeros funcionales`);
    if (messengers.length === 0) {
      console.log('⚠️ Si no se crearon mensajeros, verifica que el backend esté funcionando');
    }
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error final:', error);
    process.exit(1);
  });
}

module.exports = { createMessengersFixed };
