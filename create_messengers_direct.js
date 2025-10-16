const fetch = require('node-fetch');

async function createMessengersDirect() {
  console.log('🚚 Creando mensajeros - método directo...\n');

  // Primero verificar si el backend está funcionando
  console.log('1. 🔍 Verificando backend...');
  try {
    const healthCheck = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });

    if (!healthCheck.ok) {
      console.log('❌ Backend no responde correctamente');
      console.log('⚠️ Asegúrate de que el backend esté funcionando en el puerto 3001');
      return [];
    }

    const adminData = await healthCheck.json();
    console.log('✅ Backend funcionando');
    console.log(`   Admin login: ${adminData.success ? 'OK' : 'FAILED'}`);

    if (!adminData.success) {
      console.log('❌ Credenciales admin incorrectas');
      return [];
    }

    const adminToken = adminData.data?.token;
    console.log(`   Token obtenido: ${adminToken ? 'SI' : 'NO'}`);

    // Lista de mensajeros simplificada
    const messengers = [
      'mensajero2', 'mensajero3', 'mensajero4', 
      'juanperez', 'carloslopez', 'anagarcia'
    ];

    const createdMessengers = [];
    const password = 'mensajero123';

    // Crear cada mensajero
    console.log('\n2. 🆕 Creando mensajeros...');
    
    for (let i = 0; i < messengers.length; i++) {
      const username = messengers[i];
      console.log(`\n   [${i+1}/${messengers.length}] Procesando: ${username}`);
      
      try {
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
            password: password,
            active: true
          })
        });

        if (createResponse.ok) {
          console.log(`   ✅ ${username} creado exitosamente`);
          
          // Verificar login inmediatamente
          const loginTest = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username, password: password })
          });

          if (loginTest.ok) {
            console.log(`   🎉 Login verificado para ${username}`);
            createdMessengers.push({
              username,
              password,
              status: 'created'
            });
          } else {
            console.log(`   ⚠️ Usuario creado pero login falló`);
          }

        } else {
          const errorText = await createResponse.text();
          if (errorText.includes('ya existe')) {
            console.log(`   ℹ️ ${username} ya existe - verificando login...`);
            
            const loginTest = await fetch('http://localhost:3001/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: username, password: password })
            });

            if (loginTest.ok) {
              console.log(`   ✅ Login funcional para ${username} existente`);
              createdMessengers.push({
                username,
                password,
                status: 'existing'
              });
            } else {
              console.log(`   ❌ Usuario existe pero no puede loguear`);
            }
          } else {
            console.log(`   ❌ Error: ${errorText}`);
          }
        }

        // Pausa entre usuarios
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        console.log(`   ❌ Error con ${username}: ${error.message}`);
      }
    }

    // Verificar mensajero1 existente
    console.log('\n3. 🔍 Verificando mensajero1 existente...');
    try {
      const mensajero1Test = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'mensajero1', password: password })
      });

      if (mensajero1Test.ok) {
        console.log('   ✅ mensajero1 funcional');
        createdMessengers.unshift({
          username: 'mensajero1',
          password,
          status: 'existing'
        });
      } else {
        console.log('   ⚠️ mensajero1 no funcional');
      }
    } catch (error) {
      console.log('   ❌ Error verificando mensajero1');
    }

    // Resumen final
    console.log('\n🎉 RESUMEN FINAL DEL EQUIPO:');
    console.log('═'.repeat(60));
    console.log(`📊 Total mensajeros funcionales: ${createdMessengers.length}`);
    
    if (createdMessengers.length > 0) {
      console.log('\n👥 EQUIPO DE MENSAJEROS:');
      createdMessengers.forEach((m, index) => {
        console.log(`   ${index + 1}. ${m.username.padEnd(15)} (${m.status})`);
        console.log(`      🔐 Contraseña: ${m.password}`);
        console.log(`      ✅ Status: Login funcional`);
        console.log('');
      });
    }

    console.log('═'.repeat(60));
    
    if (createdMessengers.length > 0) {
      console.log('🚀 EQUIPO LISTO PARA OPERAR');
      console.log('📦 Los mensajeros pueden loguear y recibir pedidos');
      console.log('🎯 Logística puede asignar entregas a cualquiera');
    } else {
      console.log('⚠️ NO SE PUDIERON CREAR/VERIFICAR MENSAJEROS');
      console.log('🔧 Puede requerir verificación manual del sistema');
    }
    
    console.log('═'.repeat(60));

    return createdMessengers;

  } catch (error) {
    console.error('❌ Error general:', error.message);
    console.log('\n💡 SUGERENCIAS:');
    console.log('   - Verificar que el backend esté corriendo en puerto 3001');
    console.log('   - Verificar que la base de datos esté funcionando');
    console.log('   - Intentar reiniciar el backend con: node restart_backend_simple.js');
    return [];
  }
}

// Ejecutar
if (require.main === module) {
  createMessengersDirect().then((messengers) => {
    console.log(`\n🏁 Proceso completado: ${messengers.length} mensajeros operativos`);
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error crítico:', error);
    process.exit(1);
  });
}

module.exports = { createMessengersDirect };
