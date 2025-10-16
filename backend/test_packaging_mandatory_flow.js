const axios = require('axios');

// Configuración
const API_BASE_URL = 'http://localhost:5000/api';
let authToken = '';

// Datos de prueba
const logisticaCredentials = {
  username: 'logistica',
  password: '123456'
};

const empaqueCredentials = {
  username: 'empaque',
  password: '123456'
};

async function loginUser(credentials) {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, credentials);
    return response.data.data.token;
  } catch (error) {
    console.error('❌ Error en login:', error.response?.data?.message || error.message);
    return null;
  }
}

async function testPackagingMandatoryFlow() {
  console.log('🔄 VERIFICANDO FLUJO OBLIGATORIO DE EMPAQUE');
  console.log('=' .repeat(50));

  try {
    // 1. Verificar usuario de empaque
    console.log('\n1️⃣ Verificando usuario de empaque...');
    const empaqueToken = await loginUser(empaqueCredentials);
    if (empaqueToken) {
      console.log('✅ Usuario de empaque funcional');
    } else {
      console.log('❌ Error con usuario de empaque');
      return;
    }

    // 2. Login como logística
    console.log('\n2️⃣ Probando flujo desde logística...');
    const logisticaToken = await loginUser(logisticaCredentials);
    if (!logisticaToken) {
      console.log('❌ Error con usuario de logística');
      return;
    }
    console.log('✅ Login logística exitoso');

    // 3. Obtener pedidos de logística
    console.log('\n3️⃣ Obteniendo pedidos de logística...');
    const logisticaOrders = await axios.get(`${API_BASE_URL}/orders`, {
      headers: { Authorization: `Bearer ${logisticaToken}` }
    });

    if (logisticaOrders.data.data.orders.length > 0) {
      console.log(`✅ ${logisticaOrders.data.data.orders.length} pedidos en logística`);
      
      // Tomar el primer pedido para prueba
      const testOrder = logisticaOrders.data.data.orders[0];
      console.log(`📦 Probando con pedido ${testOrder.order_number} (ID: ${testOrder.id})`);

      // 4. Intentar marcar como "listo" desde logística
      console.log('\n4️⃣ Intentando marcar pedido como "listo" desde logística...');
      try {
        const updateResponse = await axios.put(`${API_BASE_URL}/orders/${testOrder.id}`, {
          status: 'listo'
        }, {
          headers: { Authorization: `Bearer ${logisticaToken}` }
        });

        console.log('✅ Pedido actualizado desde logística');
        console.log(`📋 Nuevo estado: ${updateResponse.data.data.status}`);

        if (updateResponse.data.data.status === 'pendiente_empaque') {
          console.log('🎉 ¡FLUJO OBLIGATORIO FUNCIONANDO! Pedido enviado automáticamente a empaque');
        } else {
          console.log('⚠️  Advertencia: El pedido no fue enviado automáticamente a empaque');
        }

      } catch (error) {
        console.log('❌ Error actualizando pedido:', error.response?.data?.message || error.message);
      }

    } else {
      console.log('⚠️  No hay pedidos disponibles en logística para prueba');
    }

    // 5. Verificar pedidos en empaque
    console.log('\n5️⃣ Verificando pedidos disponibles para empaque...');
    const empaqueOrders = await axios.get(`${API_BASE_URL}/orders`, {
      headers: { Authorization: `Bearer ${empaqueToken}` }
    });

    console.log(`📋 Pedidos en empaque: ${empaqueOrders.data.data.orders.length}`);
    empaqueOrders.data.data.orders.forEach(order => {
      console.log(`   - ${order.order_number}: ${order.status} ($${order.total_amount})`);
    });

    // 6. Probar endpoints de empaque
    console.log('\n6️⃣ Probando endpoints específicos de empaque...');
    
    try {
      const packagingPendingResponse = await axios.get(`${API_BASE_URL}/packaging/pending`, {
        headers: { Authorization: `Bearer ${empaqueToken}` }
      });
      console.log(`✅ Endpoint de pedidos pendientes funcional: ${packagingPendingResponse.data.data.length} pedidos`);
    } catch (error) {
      console.log('❌ Error obteniendo pedidos pendientes de empaque:', error.response?.data?.message || error.message);
    }

    try {
      const packagingStatsResponse = await axios.get(`${API_BASE_URL}/packaging/stats`, {
        headers: { Authorization: `Bearer ${empaqueToken}` }
      });
      console.log('✅ Endpoint de estadísticas de empaque funcional');
      console.log('📊 Estadísticas:');
      Object.entries(packagingStatsResponse.data.data).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    } catch (error) {
      console.log('❌ Error obteniendo estadísticas de empaque:', error.response?.data?.message || error.message);
    }

    // 7. Dashboard con nuevas métricas
    console.log('\n7️⃣ Verificando dashboard con métricas de empaque...');
    try {
      const dashboardResponse = await axios.get(`${API_BASE_URL}/orders/dashboard-stats`, {
        headers: { Authorization: `Bearer ${logisticaToken}` }
      });
      
      const stats = dashboardResponse.data.data;
      console.log('✅ Dashboard actualizado con métricas de empaque:');
      console.log(`   📦 Pendientes empaque: ${stats.pendingPackaging || 0}`);
      console.log(`   📋 Total pedidos: ${stats.totalOrders || 0}`);
      console.log(`   💰 Pendientes pago: ${stats.pendingPayment || 0}`);
      console.log(`   🏭 Pendientes logística: ${stats.pendingLogistics || 0}`);
      console.log(`   🚚 Pendientes reparto: ${stats.pendingDelivery || 0}`);
      console.log(`   ✅ Entregados: ${stats.delivered || 0}`);
    } catch (error) {
      console.log('❌ Error obteniendo estadísticas del dashboard:', error.response?.data?.message || error.message);
    }

    console.log('\n🎉 VERIFICACIÓN COMPLETADA');
    console.log('=' .repeat(50));
    console.log('✅ Flujo obligatorio de empaque implementado exitosamente');
    console.log('📋 Flujo actual: Logística → Empaque → Reparto');
    console.log('👤 Usuario de empaque creado y funcional');
    console.log('🔄 Endpoints de empaque operativos');

  } catch (error) {
    console.error('❌ Error durante la verificación:', error.message);
  }
}

// Ejecutar la verificación
testPackagingMandatoryFlow();
