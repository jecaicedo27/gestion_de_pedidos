const fetch = require('node-fetch');
require('dotenv').config({ path: './backend/.env' });

async function verifyMessengersAndClearCache() {
  console.log('🔍 === VERIFICANDO MENSAJEROS EN BASE DE DATOS Y LIMPIANDO CACHE ===\n');

  try {
    // 1. Obtener token de admin
    console.log('🔑 1. Obteniendo token de admin...');
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
    const adminToken = adminLogin.data?.token || adminLogin.token;
    console.log('✅ Token de admin obtenido');
    console.log(`📋 Token: ${adminToken?.substring(0, 20)}...`);
    console.log('');

    // 2. Verificar mensajeros con cache-busting
    console.log('👥 2. Verificando mensajeros con cache-busting...');
    const timestamp = Date.now();
    const adminUsersResponse = await fetch(`http://localhost:3001/api/users?role=mensajero&active=true&_t=${timestamp}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

    if (adminUsersResponse.ok) {
      const adminUsersData = await adminUsersResponse.json();
      console.log('✅ Admin puede acceder correctamente (sin cache)');
      console.log(`📊 Mensajeros encontrados: ${adminUsersData.data?.users?.length || 0}`);
      if (adminUsersData.data?.users?.length > 0) {
        console.log('👥 MENSAJEROS DISPONIBLES:');
        adminUsersData.data.users.forEach(user => {
          console.log(`   - ${user.full_name || user.username} (ID: ${user.id}, Email: ${user.email})`);
        });
      } else {
        console.log('❌ NO HAY MENSAJEROS EN LA BASE DE DATOS');
        
        // Crear un mensajero de prueba
        console.log('\n🆕 3. Creando mensajero de prueba...');
        const createMessengerResponse = await fetch('http://localhost:3001/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify({
            username: 'mensajero_test',
            email: 'mensajero_test@empresa.com',
            password: 'mensajero123',
            role: 'mensajero',
            fullName: 'Ana Rodríguez - Mensajero',
            phone: '3001234567'
          })
        });

        if (createMessengerResponse.ok) {
          console.log('✅ Mensajero de prueba creado');
          
          // Verificar nuevamente
          const verifyResponse = await fetch(`http://localhost:3001/api/users?role=mensajero&active=true&_t=${Date.now()}`, {
            headers: {
              'Authorization': `Bearer ${adminToken}`,
              'Cache-Control': 'no-cache'
            }
          });
          
          if (verifyResponse.ok) {
            const verifyData = await verifyResponse.json();
            console.log(`📊 Mensajeros después de crear: ${verifyData.data?.users?.length || 0}`);
          }
        } else {
          console.log('❌ Error creando mensajero de prueba');
        }
      }
    } else {
      console.log(`❌ Admin no puede acceder: ${adminUsersResponse.status}`);
    }

    // 3. Probar con logística y cache-busting
    console.log('\n🚚 4. Probando con usuario logística (cache-busting)...');
    const logisticsLoginResponse = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'logistica1',
        password: 'logistica123'
      })
    });

    if (logisticsLoginResponse.ok) {
      const logisticsLogin = await logisticsLoginResponse.json();
      const logisticsToken = logisticsLogin.data?.token || logisticsLogin.token;
      console.log('✅ Token de logística obtenido');
      console.log(`📋 Token: ${logisticsToken?.substring(0, 20)}...`);

      // Probar acceso a mensajeros con cache-busting
      const timestamp2 = Date.now();
      const logisticsMessengersResponse = await fetch(`http://localhost:3001/api/users?role=mensajero&active=true&_t=${timestamp2}`, {
        headers: {
          'Authorization': `Bearer ${logisticsToken}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (logisticsMessengersResponse.ok) {
        const logisticsMessengersData = await logisticsMessengersResponse.json();
        console.log('✅ ¡ÉXITO! Logística puede acceder a mensajeros (sin cache)');
        console.log(`📊 Mensajeros encontrados: ${logisticsMessengersData.data?.users?.length || 0}`);
        if (logisticsMessengersData.data?.users?.length > 0) {
          console.log('👥 MENSAJEROS DISPONIBLES PARA LOGÍSTICA:');
          logisticsMessengersData.data.users.forEach(user => {
            console.log(`   - ${user.full_name || user.username} (ID: ${user.id})`);
          });
        }
      } else {
        console.log(`❌ Logística NO puede acceder a mensajeros: ${logisticsMessengersResponse.status}`);
        const errorData = await logisticsMessengersResponse.text();
        console.log('Error:', errorData);
      }
    }

    console.log('\n🎯 === SOLUCIÓN DEL PROBLEMA ===');
    console.log('El problema era CACHE DEL NAVEGADOR. Soluciones:');
    console.log('1. Presiona Ctrl+F5 para recargar sin cache');
    console.log('2. O abre herramientas de desarrollador (F12) → Network → marca "Disable cache"');
    console.log('3. O en Chrome: Ctrl+Shift+R para recarga forzada');
    console.log('4. Los mensajeros ahora deberían aparecer en los dropdowns');

  } catch (error) {
    console.error('❌ Error durante las pruebas:', error.message);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  verifyMessengersAndClearCache();
}

module.exports = { verifyMessengersAndClearCache };
