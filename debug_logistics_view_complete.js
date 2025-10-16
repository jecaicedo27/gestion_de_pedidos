const fetch = require('node-fetch');

async function debugLogisticsViewComplete() {
  console.log('🔧 Diagnosticando vista completa de Logística...\n');

  try {
    // 1. Login como logística
    console.log('1. 🔐 Logueando como logística...');
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
      return;
    }

    const logisticsData = await logisticsLogin.json();
    const logisticsToken = logisticsData.data?.token;
    
    console.log('✅ Login de logística exitoso');
    console.log('👤 Datos de logística:');
    console.log(`   - ID: ${logisticsData.data.user.id}`);
    console.log(`   - Username: ${logisticsData.data.user.username}`);
    console.log(`   - Nombre: ${logisticsData.data.user.full_name}`);
    console.log(`   - Rol: ${logisticsData.data.user.role}`);

    // 2. Probar diferentes endpoints de pedidos que usa logística
    console.log('\n2. 🔍 Probando endpoint principal de pedidos...');
    
    const mainOrdersResponse = await fetch('http://localhost:3001/api/orders?search=&status=&dateFrom=&dateTo=&page=1&limit=10&sortBy=created_at&sortOrder=DESC', {
      headers: {
        'Authorization': `Bearer ${logisticsToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (mainOrdersResponse.ok) {
      const mainOrders = await mainOrdersResponse.json();
      console.log(`✅ Endpoint principal: ${mainOrders.data?.orders?.length || 0} pedidos encontrados`);
      console.log(`📊 Total en sistema: ${mainOrders.data?.pagination?.total || 0}`);
      
      if (mainOrders.data?.orders?.length > 0) {
        console.log('\n📋 Primeros 3 pedidos:');
        mainOrders.data.orders.slice(0, 3).forEach((order, index) => {
          console.log(`   ${index + 1}. ${order.order_number} - ${order.status} - ${order.customer_name}`);
        });
      }
    } else {
      console.log(`❌ Endpoint principal falló: ${mainOrdersResponse.status}`);
    }

    // 3. Probar endpoint específico de logística
    console.log('\n3. 📦 Probando endpoint específico de logística...');
    
    const logisticsOrdersResponse = await fetch('http://localhost:3001/api/logistics/ready-for-delivery', {
      headers: {
        'Authorization': `Bearer ${logisticsToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (logisticsOrdersResponse.ok) {
      const logisticsOrders = await logisticsOrdersResponse.json();
      console.log(`✅ Endpoint logística: ${logisticsOrders.data?.length || logisticsOrders.length || 0} pedidos listos para entrega`);
      
      const orders = logisticsOrders.data || logisticsOrders;
      if (orders.length > 0) {
        console.log('\n📋 Pedidos listos para entrega:');
        orders.slice(0, 3).forEach((order, index) => {
          console.log(`   ${index + 1}. ${order.order_number} - ${order.status} - Mensajero: ${order.assigned_messenger_id || 'No asignado'}`);
        });
      }
    } else {
      console.log(`❌ Endpoint logística falló: ${logisticsOrdersResponse.status}`);
      const errorText = await logisticsOrdersResponse.text();
      console.log('📄 Error:', errorText);
    }

    // 4. Probar filtros específicos que usa logística
    console.log('\n4. 🎯 Probando filtros específicos de estados...');
    
    const statusFilters = [
      'pendiente_por_facturacion',
      'en_logistica',
      'listo_para_entrega',
      'en_reparto',
      'empacado'
    ];

    for (const status of statusFilters) {
      const statusResponse = await fetch(`http://localhost:3001/api/orders?status=${status}&page=1&limit=5`, {
        headers: {
          'Authorization': `Bearer ${logisticsToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        const count = statusData.data?.orders?.length || 0;
        const total = statusData.data?.pagination?.total || 0;
        console.log(`   📊 ${status}: ${count} pedidos mostrados, ${total} total`);
      } else {
        console.log(`   ❌ Error en ${status}: ${statusResponse.status}`);
      }
    }

    // 5. Verificar permisos y roles
    console.log('\n5. 🔐 Verificando permisos del usuario...');
    
    const userInfoResponse = await fetch(`http://localhost:3001/api/users/${logisticsData.data.user.id}`, {
      headers: {
        'Authorization': `Bearer ${logisticsToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      console.log('✅ Info del usuario obtenida:');
      console.log(`   - Activo: ${userInfo.data.active}`);
      console.log(`   - Rol confirmado: ${userInfo.data.role}`);
      console.log(`   - Último login: ${userInfo.data.last_login || 'Nunca'}`);
    } else {
      console.log(`❌ Error obteniendo info del usuario: ${userInfoResponse.status}`);
    }

    // 6. Probar dashboard stats
    console.log('\n6. 📈 Probando estadísticas del dashboard...');
    
    const statsResponse = await fetch('http://localhost:3001/api/orders/dashboard-stats', {
      headers: {
        'Authorization': `Bearer ${logisticsToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log('✅ Estadísticas obtenidas:');
      console.log(`   - Total pedidos: ${stats.data?.total_orders || 'N/A'}`);
      console.log(`   - Pendientes: ${stats.data?.pending_orders || 'N/A'}`);
      console.log(`   - En proceso: ${stats.data?.in_process_orders || 'N/A'}`);
      console.log(`   - Completados: ${stats.data?.completed_orders || 'N/A'}`);
    } else {
      console.log(`❌ Error obteniendo estadísticas: ${statsResponse.status}`);
    }

    // 7. Probar sin filtros para ver todos los pedidos
    console.log('\n7. 🌍 Probando obtener TODOS los pedidos sin filtros...');
    
    const allOrdersResponse = await fetch('http://localhost:3001/api/orders', {
      headers: {
        'Authorization': `Bearer ${logisticsToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (allOrdersResponse.ok) {
      const allOrders = await allOrdersResponse.json();
      const orders = allOrders.data?.orders || allOrders.orders || allOrders;
      console.log(`✅ Total pedidos sin filtros: ${orders.length}`);
      
      if (orders.length > 0) {
        console.log('\n📊 Resumen por estados:');
        const statusCount = {};
        orders.forEach(order => {
          statusCount[order.status] = (statusCount[order.status] || 0) + 1;
        });
        
        Object.entries(statusCount).forEach(([status, count]) => {
          console.log(`   - ${status}: ${count} pedidos`);
        });
      }
    } else {
      console.log(`❌ Error obteniendo todos los pedidos: ${allOrdersResponse.status}`);
    }

    // 8. Diagnóstico final
    console.log('\n8. 🎯 DIAGNÓSTICO FINAL:');
    
    // Comparar con admin para verificar diferencias
    console.log('\n🔄 Comparando con vista de admin...');
    
    const adminLogin = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });

    if (adminLogin.ok) {
      const adminData = await adminLogin.json();
      const adminToken = adminData.data?.token;
      
      const adminOrdersResponse = await fetch('http://localhost:3001/api/orders', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (adminOrdersResponse.ok) {
        const adminOrders = await adminOrdersResponse.json();
        const adminCount = adminOrders.data?.orders?.length || adminOrders.orders?.length || 0;
        console.log(`📊 Admin ve: ${adminCount} pedidos`);
        console.log(`📊 Logística ve: Los resultados mostrados arriba`);
        
        if (adminCount > 0) {
          console.log('\n✅ CONCLUSIÓN:');
          console.log('   El problema puede estar en:');
          console.log('   1. Permisos específicos del rol logística');
          console.log('   2. Filtros aplicados en el frontend de logística');
          console.log('   3. Configuración específica de la página de logística');
        } else {
          console.log('\n⚠️ CONCLUSIÓN:');
          console.log('   No hay pedidos en el sistema para mostrar');
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar
if (require.main === module) {
  debugLogisticsViewComplete().then(() => {
    console.log('\n🏁 Diagnóstico completado');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { debugLogisticsViewComplete };
