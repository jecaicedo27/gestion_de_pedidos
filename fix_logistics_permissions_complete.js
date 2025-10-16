const fetch = require('node-fetch');

async function fixLogisticsPermissions() {
  console.log('🔧 Arreglando permisos de logística...\n');

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

    // 2. Verificar datos del usuario logística
    console.log('\n2. 🔍 Verificando usuario de logística...');
    
    const logisticUserResponse = await fetch('http://localhost:3001/api/users?username=logistica1', {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (logisticUserResponse.ok) {
      const users = await logisticUserResponse.json();
      const logisticUser = users.data?.users?.[0] || users.users?.[0] || users[0];
      
      if (logisticUser) {
        console.log('✅ Usuario encontrado:');
        console.log(`   - ID: ${logisticUser.id}`);
        console.log(`   - Username: ${logisticUser.username}`);
        console.log(`   - Role: ${logisticUser.role}`);
        console.log(`   - Active: ${logisticUser.active}`);

        // Verificar si está activo
        if (!logisticUser.active) {
          console.log('⚠️ Usuario inactivo, activando...');
          
          const activateResponse = await fetch(`http://localhost:3001/api/users/${logisticUser.id}`, {
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

        // Verificar/corregir role
        if (logisticUser.role !== 'logistica') {
          console.log(`⚠️ Role incorrecto (${logisticUser.role}), corrigiendo...`);
          
          const roleResponse = await fetch(`http://localhost:3001/api/users/${logisticUser.id}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${adminToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              role: 'logistica'
            })
          });

          if (roleResponse.ok) {
            console.log('✅ Role corregido a logistica');
          } else {
            console.log('❌ Error corrigiendo role');
          }
        }
      } else {
        console.log('❌ Usuario logistica1 no encontrado');
        return;
      }
    } else {
      console.log('❌ Error obteniendo usuario logistica1');
      return;
    }

    // 3. Login como logística
    console.log('\n3. 🧪 Probando login como logística...');
    const logisticsLogin = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'logistica1',
        password: 'logistica123'
      })
    });

    if (!logisticsLogin.ok) {
      console.log('❌ Login de logística falló');
      const errorText = await logisticsLogin.text();
      console.log('📄 Error:', errorText);
      
      // Resetear contraseña
      console.log('\n🔄 Reseteando contraseña de logística...');
      const resetResponse = await fetch(`http://localhost:3001/api/users/14`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password: 'logistica123'
        })
      });

      if (resetResponse.ok) {
        console.log('✅ Contraseña reseteada');
        
        // Probar login nuevamente
        console.log('\n🔁 Intentando login nuevamente...');
        const retryLogin = await fetch('http://localhost:3001/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'logistica1',
            password: 'logistica123'
          })
        });

        if (!retryLogin.ok) {
          console.log('❌ Login sigue fallando');
          return;
        }

        const retryData = await retryLogin.json();
        logisticsToken = retryData.data?.token;
      } else {
        console.log('❌ Error reseteando contraseña');
        return;
      }
    } else {
      const logisticsData = await logisticsLogin.json();
      logisticsToken = logisticsData.data?.token;
    }

    console.log('✅ Login de logística exitoso');

    // 4. Probar acceso a pedidos
    console.log('\n4. 📦 Probando acceso a pedidos...');
    
    const ordersResponse = await fetch('http://localhost:3001/api/orders', {
      headers: {
        'Authorization': `Bearer ${logisticsToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (ordersResponse.ok) {
      const orders = await ordersResponse.json();
      const ordersList = orders.data?.orders || orders.orders || [];
      console.log(`✅ Acceso exitoso: ${ordersList.length} pedidos encontrados`);
      
      if (ordersList.length > 0) {
        console.log('\n📋 Primeros 3 pedidos:');
        ordersList.slice(0, 3).forEach((order, index) => {
          console.log(`   ${index + 1}. ${order.order_number} - ${order.status} - ${order.customer_name}`);
        });
      }
    } else {
      console.log(`❌ Error accediendo a pedidos: ${ordersResponse.status}`);
      const errorText = await ordersResponse.text();
      console.log('📄 Error:', errorText);
    }

    // 5. Probar endpoint de logística específico
    console.log('\n5. 🎯 Probando endpoint específico de logística...');
    
    const logisticsEndpointResponse = await fetch('http://localhost:3001/api/logistics/ready-for-delivery', {
      headers: {
        'Authorization': `Bearer ${logisticsToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (logisticsEndpointResponse.ok) {
      const logisticsOrders = await logisticsEndpointResponse.json();
      const ordersList = logisticsOrders.data || logisticsOrders;
      console.log(`✅ Endpoint de logística exitoso: ${ordersList.length} pedidos listos para entrega`);
    } else {
      console.log(`❌ Error en endpoint de logística: ${logisticsEndpointResponse.status}`);
      const errorText = await logisticsEndpointResponse.text();
      console.log('📄 Error:', errorText);
    }

    // 6. Comparación final
    console.log('\n6. 📊 COMPARACIÓN FINAL:');
    
    // Admin
    const adminOrdersResponse = await fetch('http://localhost:3001/api/orders', {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (adminOrdersResponse.ok) {
      const adminOrders = await adminOrdersResponse.json();
      const adminCount = adminOrders.data?.orders?.length || 0;
      console.log(`   👑 Admin ve: ${adminCount} pedidos`);
    }

    // Logística  
    const logisticsFinalResponse = await fetch('http://localhost:3001/api/orders', {
      headers: {
        'Authorization': `Bearer ${logisticsToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (logisticsFinalResponse.ok) {
      const logisticsOrders = await logisticsFinalResponse.json();
      const logisticsCount = logisticsOrders.data?.orders?.length || 0;
      console.log(`   📦 Logística ve: ${logisticsCount} pedidos`);
      
      if (logisticsCount > 0) {
        console.log('\n🎉 ¡PROBLEMA SOLUCIONADO!');
        console.log('   Logística ya puede ver los pedidos');
      } else {
        console.log('\n⚠️ Logística aún no ve pedidos');
        console.log('   El problema puede estar en el frontend o controlador');
      }
    } else {
      console.log(`   ❌ Logística error: ${logisticsFinalResponse.status}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar
if (require.main === module) {
  fixLogisticsPermissions().then(() => {
    console.log('\n🏁 Fix completado');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { fixLogisticsPermissions };
