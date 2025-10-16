const fetch = require('node-fetch');

async function fixAndCreateMessengersTeam() {
  console.log('🔧 Arreglando mensajero1 y creando equipo completo...\n');

  try {
    // 1. Verificar backend
    console.log('1. 🔍 Verificando backend...');
    let backendWorking = false;
    
    try {
      const healthResponse = await fetch('http://localhost:3001/api/health');
      if (healthResponse.ok) {
        backendWorking = true;
        console.log('✅ Backend respondiendo en puerto 3001');
      }
    } catch (error) {
      console.log('⚠️ Backend no responde, intentando login directo...');
    }

    // 2. Probar login admin
    console.log('\n2. 🔐 Probando login admin...');
    const adminLogin = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });

    if (!adminLogin.ok) {
      console.log('❌ Error login admin - Backend no está funcionando correctamente');
      console.log('💡 SOLUCIÓN: Reinicia el backend manualmente');
      console.log('   - Ctrl+C para detener backend actual');
      console.log('   - cd backend');
      console.log('   - node server.js');
      return [];
    }

    const adminData = await adminLogin.json();
    const adminToken = adminData.data?.token;
    console.log('✅ Admin login exitoso');

    // 3. Diagnosticar mensajero1
    console.log('\n3. 🕵️ Diagnosticando mensajero1...');
    const mensajero1Test = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'mensajero1',
        password: 'mensajero123'
      })
    });

    if (mensajero1Test.ok) {
      console.log('✅ mensajero1 funciona correctamente - no hay problema');
    } else {
      console.log('❌ mensajero1 no funciona, investigando...');
      
      // Buscar usuario en base de datos
      const usersResponse = await fetch('http://localhost:3001/api/users', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (usersResponse.ok) {
        const users = await usersResponse.json();
        const allUsers = users.data?.users || users.users || [];
        const mensajero1 = allUsers.find(u => u.username === 'mensajero1');

        if (mensajero1) {
          console.log(`   - Usuario existe (ID: ${mensajero1.id})`);
          console.log(`   - Role: ${mensajero1.role}`);
          console.log(`   - Active: ${mensajero1.active}`);
          
          // Resetear usuario
          console.log('   🔄 Reseteando mensajero1...');
          const resetResponse = await fetch(`http://localhost:3001/api/users/${mensajero1.id}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${adminToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              username: 'mensajero1',
              full_name: 'Ana Rodríguez - Mensajero',
              email: 'mensajero1@empresa.com',
              role: 'mensajero',
              password: 'mensajero123',
              active: true
            })
          });

          if (resetResponse.ok) {
            console.log('   ✅ mensajero1 reseteado exitosamente');
          }
        } else {
          console.log('   - Usuario no existe, creando...');
          
          const createResponse = await fetch('http://localhost:3001/api/users', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${adminToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              username: 'mensajero1',
              full_name: 'Ana Rodríguez - Mensajero',
              email: 'mensajero1@empresa.com',
              role: 'mensajero',
              password: 'mensajero123',
              active: true
            })
          });

          if (createResponse.ok) {
            console.log('   ✅ mensajero1 creado exitosamente');
          }
        }
      }
    }

    // 4. Crear equipo completo de mensajeros
    console.log('\n4. 👥 Creando equipo completo de mensajeros...');
    
    const messagersToCreate = [
      { username: 'mensajero2', name: 'Carlos Martínez' },
      { username: 'mensajero3', name: 'María González' },
      { username: 'mensajero4', name: 'José Rodríguez' },
      { username: 'mensajero5', name: 'Ana Pérez' },
      { username: 'juanperez', name: 'Juan Pérez' },
      { username: 'carloslopez', name: 'Carlos López' },
      { username: 'mariasanchez', name: 'María Sánchez' }
    ];

    const workingMessengers = [];

    for (const messenger of messagersToCreate) {
      console.log(`\n   🔨 Procesando: ${messenger.username}`);
      
      // Crear usuario
      const createResponse = await fetch('http://localhost:3001/api/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: messenger.username,
          full_name: `${messenger.name} - Mensajero`,
          email: `${messenger.username}@empresa.com`,
          role: 'mensajero',
          password: 'mensajero123',
          active: true
        })
      });

      if (createResponse.ok) {
        console.log(`   ✅ ${messenger.username} creado`);
        
        // Verificar login inmediatamente
        const loginTest = await fetch('http://localhost:3001/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: messenger.username,
            password: 'mensajero123'
          })
        });

        if (loginTest.ok) {
          console.log(`   🎉 Login verificado para ${messenger.username}`);
          workingMessengers.push({
            username: messenger.username,
            name: messenger.name,
            status: 'created'
          });
        }
      } else {
        const errorText = await createResponse.text();
        if (errorText.includes('ya existe')) {
          console.log(`   ℹ️ ${messenger.username} ya existe, verificando...`);
          
          // Probar login con usuario existente
          const loginTest = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: messenger.username,
              password: 'mensajero123'
            })
          });

          if (loginTest.ok) {
            console.log(`   ✅ ${messenger.username} funciona correctamente`);
            workingMessengers.push({
              username: messenger.username,
              name: messenger.name,
              status: 'existing'
            });
          } else {
            console.log(`   ⚠️ ${messenger.username} existe pero no puede loguear`);
          }
        }
      }
    }

    // 5. Verificar mensajero1 final
    console.log('\n5. 🔍 Verificación final de mensajero1...');
    const mensajero1FinalTest = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'mensajero1',
        password: 'mensajero123'
      })
    });

    if (mensajero1FinalTest.ok) {
      console.log('   ✅ mensajero1 funcionando correctamente');
      workingMessengers.unshift({
        username: 'mensajero1',
        name: 'Ana Rodríguez',
        status: 'fixed'
      });
    } else {
      console.log('   ❌ mensajero1 aún no funciona');
    }

    // 6. Resumen final
    console.log('\n🎉 EQUIPO DE MENSAJEROS FINAL:');
    console.log('═'.repeat(70));
    console.log(`📊 Total mensajeros funcionales: ${workingMessengers.length}`);
    
    if (workingMessengers.length > 0) {
      console.log('\n👥 LISTA COMPLETA DEL EQUIPO:');
      workingMessengers.forEach((messenger, index) => {
        console.log(`   ${(index + 1).toString().padStart(2)}. ${messenger.username.padEnd(15)} - ${messenger.name}`);
        console.log(`       🔐 Contraseña: mensajero123`);
        console.log(`       📱 Estado: ${messenger.status === 'created' ? 'Recién creado' : messenger.status === 'fixed' ? 'Reparado' : 'Existente funcional'}`);
        console.log('');
      });

      console.log('═'.repeat(70));
      console.log('🚀 EQUIPO COMPLETO Y LISTO');
      console.log('📦 Todos pueden loguear y recibir pedidos');
      console.log('🎯 Logística puede asignar entregas a cualquier mensajero');
      console.log('✅ Sistema de entregas completamente operativo');
      console.log('═'.repeat(70));
    } else {
      console.log('\n❌ NO SE PUDIERON CREAR/ARREGLAR MENSAJEROS');
      console.log('🔧 Verifica que el backend esté funcionando correctamente');
    }

    return workingMessengers;

  } catch (error) {
    console.error('❌ Error crítico:', error.message);
    console.log('\n💡 SOLUCIONES SUGERIDAS:');
    console.log('   1. Reiniciar backend: cd backend && node server.js');
    console.log('   2. Verificar conexión a base de datos');
    console.log('   3. Verificar puerto 3001 disponible');
    return [];
  }
}

// Ejecutar
if (require.main === module) {
  fixAndCreateMessengersTeam().then((messengers) => {
    console.log(`\n🏁 Proceso completado: ${messengers.length} mensajeros operativos`);
    if (messengers.length >= 3) {
      console.log('🎉 ¡EQUIPO DE MENSAJEROS LISTO PARA TRABAJAR!');
    }
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error final:', error);
    process.exit(1);
  });
}

module.exports = { fixAndCreateMessengersTeam };
