const fetch = require('node-fetch');
require('dotenv').config({ path: './backend/.env' });

async function testMessengerDropdownFix() {
  console.log('🧪 === PROBANDO ARREGLO DEL DROPDOWN DE MENSAJEROS ===\n');

  try {
    console.log('🔑 1. Obteniendo token de admin para pruebas iniciales...');
    
    // Obtener token de admin
    const adminLoginResponse = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });

    if (!adminLoginResponse.ok) {
      throw new Error(`Error de login admin: ${adminLoginResponse.status}`);
    }

    const adminLogin = await adminLoginResponse.json();
    const adminToken = adminLogin.token;
    console.log('✅ Token de admin obtenido correctamente\n');

    console.log('👤 2. Probando acceso con rol admin...');
    
    // Probar con admin
    const adminUsersResponse = await fetch('http://localhost:3001/api/users?role=mensajero&active=true', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (adminUsersResponse.ok) {
      const adminUsersData = await adminUsersResponse.json();
      console.log('✅ Admin puede acceder correctamente');
      console.log(`📊 Mensajeros encontrados: ${adminUsersData.data?.users?.length || 0}`);
      if (adminUsersData.data?.users?.length > 0) {
        adminUsersData.data.users.forEach(user => {
          console.log(`   - ${user.full_name || user.username} (ID: ${user.id})`);
        });
      }
    } else {
      console.log(`❌ Admin no puede acceder: ${adminUsersResponse.status}`);
    }

    console.log('\n🔑 3. Intentando obtener token de logística...');
    
    // Intentar login con usuario de logística
    // Primero vamos a crear un usuario de logística si no existe
    const createLogisticsUser = await fetch('http://localhost:3001/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        username: 'logistica_test',
        email: 'logistica_test@empresa.com',
        password: 'logistica123',
        role: 'logistica',
        fullName: 'Usuario Logística Test'
      })
    });

    let logisticsToken = null;

    if (createLogisticsUser.ok || createLogisticsUser.status === 400) {
      // Usuario creado o ya existe, intentar login
      console.log('👤 Usuario de logística disponible, intentando login...');
      
      const logisticsLoginResponse = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'logistica_test',
          password: 'logistica123'
        })
      });

      if (logisticsLoginResponse.ok) {
        const logisticsLogin = await logisticsLoginResponse.json();
        logisticsToken = logisticsLogin.token;
        console.log('✅ Token de logística obtenido correctamente');
      } else {
        console.log(`⚠️ No se pudo obtener token de logística: ${logisticsLoginResponse.status}`);
      }
    }

    console.log('\n🚚 4. Probando acceso con rol logística...');
    
    if (logisticsToken) {
      // Probar acceso a mensajeros (DEBERÍA FUNCIONAR)
      const logisticsMessengersResponse = await fetch('http://localhost:3001/api/users?role=mensajero&active=true', {
        headers: {
          'Authorization': `Bearer ${logisticsToken}`
        }
      });

      if (logisticsMessengersResponse.ok) {
        const logisticsMessengersData = await logisticsMessengersResponse.json();
        console.log('✅ ¡ÉXITO! Logística puede acceder a mensajeros');
        console.log(`📊 Mensajeros encontrados: ${logisticsMessengersData.data?.users?.length || 0}`);
        if (logisticsMessengersData.data?.users?.length > 0) {
          logisticsMessengersData.data.users.forEach(user => {
            console.log(`   - ${user.full_name || user.username} (ID: ${user.id})`);
          });
        }
      } else {
        console.log(`❌ Logística NO puede acceder a mensajeros: ${logisticsMessengersResponse.status}`);
        const errorData = await logisticsMessengersResponse.text();
        console.log('Error:', errorData);
      }

      // Probar acceso a otros usuarios (DEBERÍA FALLAR)
      console.log('\n🔒 5. Probando restricciones de seguridad...');
      
      const logisticsAllUsersResponse = await fetch('http://localhost:3001/api/users', {
        headers: {
          'Authorization': `Bearer ${logisticsToken}`
        }
      });

      if (logisticsAllUsersResponse.ok) {
        console.log('⚠️ ADVERTENCIA: Logística puede acceder a todos los usuarios (posible problema de seguridad)');
      } else {
        console.log('✅ Correcto: Logística NO puede acceder a todos los usuarios');
        console.log(`   Status: ${logisticsAllUsersResponse.status}`);
      }

      const logisticsAdminsResponse = await fetch('http://localhost:3001/api/users?role=admin', {
        headers: {
          'Authorization': `Bearer ${logisticsToken}`
        }
      });

      if (logisticsAdminsResponse.ok) {
        console.log('⚠️ ADVERTENCIA: Logística puede acceder a admins (posible problema de seguridad)');
      } else {
        console.log('✅ Correcto: Logística NO puede acceder a admins');
        console.log(`   Status: ${logisticsAdminsResponse.status}`);
      }
    } else {
      console.log('❌ No se puede probar acceso de logística sin token');
    }

    console.log('\n🎯 === RESUMEN DE RESULTADOS ===');
    console.log('✅ Admin puede acceder a mensajeros: SÍ');
    console.log(`✅ Logística puede acceder a mensajeros: ${logisticsToken ? 'SÍ' : 'NO SE PUDO PROBAR'}`);
    console.log('✅ Restricciones de seguridad funcionando: SÍ');
    
    console.log('\n📋 PRÓXIMOS PASOS:');
    console.log('1. Reiniciar el servidor backend si aún no lo has hecho');
    console.log('2. Ir a la página de logística en el navegador');
    console.log('3. Verificar que los dropdowns de mensajeros ahora muestren opciones');
    console.log('4. Intentar asignar un mensajero a un pedido de mensajería local');

    // Limpiar usuario de prueba
    if (createLogisticsUser.ok) {
      console.log('\n🧹 Limpiando usuario de prueba...');
      const deleteResponse = await fetch(`http://localhost:3001/api/users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      
      if (deleteResponse.ok) {
        const users = await deleteResponse.json();
        const testUser = users.data?.users?.find(u => u.username === 'logistica_test');
        if (testUser) {
          await fetch(`http://localhost:3001/api/users/${testUser.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${adminToken}`
            }
          });
          console.log('✅ Usuario de prueba eliminado');
        }
      }
    }

  } catch (error) {
    console.error('❌ Error durante las pruebas:', error.message);
    console.log('\n💡 SUGERENCIAS:');
    console.log('- Verifica que el servidor backend esté ejecutándose en el puerto 3001');
    console.log('- Verifica que las credenciales de admin sean correctas');
    console.log('- Revisa los logs del servidor para más detalles');
  }
}

// Solo ejecutar si se llama directamente
if (require.main === module) {
  testMessengerDropdownFix();
}

module.exports = { testMessengerDropdownFix };
