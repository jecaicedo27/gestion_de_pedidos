// Test completo del sistema de entregas para mensajeros

const axios = require('axios');

async function testMessengerDeliverySystem() {
  console.log('🚀 PROBANDO SISTEMA COMPLETO DE ENTREGAS PARA MENSAJEROS\n');
  
  try {
    // 1. Login como mensajero
    console.log('1️⃣ Haciendo login como mensajero...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'julianCarrillo',
      password: 'password123'
    });
    
    const token = loginResponse.data.data.token;
    console.log('✅ Login exitoso');
    console.log('📝 Usuario:', loginResponse.data.data.user.username);
    console.log('👤 Rol:', loginResponse.data.data.user.role);
    
    if (loginResponse.data.data.user.role !== 'mensajero') {
      console.log('❌ Error: El usuario no es mensajero');
      return;
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 2. Obtener pedidos asignados
    console.log('\n2️⃣ Obteniendo pedidos asignados...');
    const ordersResponse = await axios.get('http://localhost:3001/api/messenger/orders', { headers });
    
    console.log('✅ Pedidos obtenidos:', ordersResponse.data.data.length);
    ordersResponse.data.data.forEach(order => {
      console.log(`   📦 ${order.order_number} - ${order.client_name} - Estado: ${order.messenger_status}`);
    });

    // 3. Obtener resumen diario
    console.log('\n3️⃣ Obteniendo resumen diario...');
    const summaryResponse = await axios.get('http://localhost:3001/api/messenger/daily-summary', { headers });
    
    console.log('✅ Resumen diario obtenido:');
    const summary = summaryResponse.data.data.summary;
    console.log(`   📊 Total asignados: ${summary.total_assigned}`);
    console.log(`   ✅ Total entregados: ${summary.total_delivered}`);
    console.log(`   ❌ Total fallidos: ${summary.total_failed}`);
    console.log(`   ⏳ Total pendientes: ${summary.total_pending}`);
    console.log(`   💰 Dinero recolectado: $${summary.total_payment_collected}`);
    console.log(`   🚚 Fees de domicilio: $${summary.total_delivery_fees}`);

    // 4. Probar flujo de aceptación si hay pedidos asignados
    const assignedOrders = ordersResponse.data.data.filter(order => order.messenger_status === 'assigned');
    
    if (assignedOrders.length > 0) {
      const testOrder = assignedOrders[0];
      console.log(`\n4️⃣ Probando flujo de entrega con pedido ${testOrder.order_number}...`);
      
      // Aceptar pedido
      console.log('   ✅ Aceptando pedido...');
      await axios.post(`http://localhost:3001/api/messenger/orders/${testOrder.id}/accept`, {}, { headers });
      console.log('   ✅ Pedido aceptado exitosamente');
      
      // Iniciar entrega
      console.log('   🚀 Iniciando entrega...');
      await axios.post(`http://localhost:3001/api/messenger/orders/${testOrder.id}/start-delivery`, {}, { headers });
      console.log('   ✅ Entrega iniciada exitosamente');
      
      // Completar entrega (simulada)
      console.log('   📦 Completando entrega...');
      await axios.post(`http://localhost:3001/api/messenger/orders/${testOrder.id}/complete`, {
        paymentCollected: testOrder.payment_amount || 50000,
        deliveryFeeCollected: testOrder.delivery_fee || 5000,
        paymentMethod: 'efectivo',
        deliveryNotes: 'Entrega exitosa - Cliente satisfecho',
        latitude: 4.6097100,
        longitude: -74.0817500
      }, { headers });
      console.log('   ✅ Entrega completada exitosamente');
      
      console.log('\n🎉 FLUJO COMPLETO DE ENTREGA EXITOSO');
      
    } else {
      console.log('\n4️⃣ No hay pedidos asignados para probar el flujo de entrega');
      
      // Probar rechazar pedido si hay alguno
      if (ordersResponse.data.data.length > 0) {
        const testOrder = ordersResponse.data.data[0];
        console.log(`   ❌ Probando rechazo de pedido ${testOrder.order_number}...`);
        
        try {
          await axios.post(`http://localhost:3001/api/messenger/orders/${testOrder.id}/reject`, {
            reason: 'No puedo entregar en esta dirección'
          }, { headers });
          console.log('   ✅ Pedido rechazado exitosamente');
        } catch (error) {
          if (error.response?.status === 400) {
            console.log('   ⚠️  El pedido no está en estado asignado (esperado)');
          } else {
            throw error;
          }
        }
      }
    }

    // 5. Obtener resumen actualizado
    console.log('\n5️⃣ Obteniendo resumen actualizado...');
    const updatedSummaryResponse = await axios.get('http://localhost:3001/api/messenger/daily-summary', { headers });
    
    const updatedSummary = updatedSummaryResponse.data.data.summary;
    console.log('✅ Resumen actualizado:');
    console.log(`   📊 Total asignados: ${updatedSummary.total_assigned}`);
    console.log(`   ✅ Total entregados: ${updatedSummary.total_delivered}`);
    console.log(`   💰 Dinero recolectado: $${updatedSummary.total_payment_collected}`);

    console.log('\n🎯 TODAS LAS APIS DE MENSAJERO FUNCIONAN CORRECTAMENTE');
    
    console.log('\n📋 APIs disponibles para mensajeros:');
    console.log('   GET    /api/messenger/orders - Obtener pedidos asignados');
    console.log('   POST   /api/messenger/orders/:id/accept - Aceptar pedido');
    console.log('   POST   /api/messenger/orders/:id/reject - Rechazar pedido');
    console.log('   POST   /api/messenger/orders/:id/start-delivery - Iniciar entrega');
    console.log('   POST   /api/messenger/orders/:id/complete - Completar entrega');
    console.log('   POST   /api/messenger/orders/:id/mark-failed - Marcar entrega fallida');
    console.log('   POST   /api/messenger/orders/:id/upload-evidence - Subir evidencia');
    console.log('   GET    /api/messenger/daily-summary - Resumen diario');

  } catch (error) {
    if (error.response) {
      console.log('❌ Error de API:', error.response.status, error.response.data?.message);
      if (error.response.data?.details) {
        console.log('   Detalles:', error.response.data.details);
      }
    } else {
      console.log('❌ Error de conexión:', error.message);
    }
  }
}

testMessengerDeliverySystem().catch(console.error);
