const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001';

// Función para hacer requests con token
async function requestWithAuth(url, options = {}) {
  // Usar un token de mensajero (deberías reemplazar esto con un token real)
  const token = 'tu_token_de_mensajero_aqui';
  
  return fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  });
}

async function testMessengerFlow() {
  console.log('🧪 === TESTING COMPLETE MESSENGER FLOW ===');

  try {
    // 1. Obtener pedidos del mensajero
    console.log('\n📋 1. Obteniendo pedidos asignados al mensajero...');
    const ordersResponse = await requestWithAuth('/api/messenger/orders');
    
    if (!ordersResponse.ok) {
      console.error('❌ Error obteniendo pedidos:', ordersResponse.status);
      const error = await ordersResponse.text();
      console.error('Error details:', error);
      return;
    }
    
    const ordersData = await ordersResponse.json();
    console.log('✅ Pedidos obtenidos exitosamente');
    console.log('📊 Estructura de respuesta:', {
      success: ordersData.success,
      dataType: typeof ordersData.data,
      ordersCount: ordersData.data?.length || 0
    });

    if (ordersData.data && ordersData.data.length > 0) {
      const order = ordersData.data[0];
      console.log('📦 Primer pedido:', {
        id: order.id,
        order_number: order.order_number,
        client_name: order.client_name,
        customer_name: order.customer_name,
        messenger_status: order.messenger_status,
        status: order.status,
        assigned_messenger_id: order.assigned_messenger_id
      });

      const orderId = order.id;

      // 2. Test de aceptación de pedido (solo si está en estado 'assigned')
      if (order.messenger_status === 'assigned') {
        console.log('\n✅ 2. Probando aceptación de pedido...');
        const acceptResponse = await requestWithAuth(`/api/messenger/orders/${orderId}/accept`, {
          method: 'POST'
        });
        
        if (acceptResponse.ok) {
          const acceptResult = await acceptResponse.json();
          console.log('✅ Pedido aceptado:', acceptResult.message);
        } else {
          console.error('❌ Error aceptando pedido:', acceptResponse.status);
        }
      } else {
        console.log(`ℹ️  2. Pedido no está en estado 'assigned' (actual: ${order.messenger_status})`);
      }

      // 3. Test de inicio de entrega (solo si está en estado 'accepted')
      if (order.messenger_status === 'accepted') {
        console.log('\n🚀 3. Probando inicio de entrega...');
        const startResponse = await requestWithAuth(`/api/messenger/orders/${orderId}/start-delivery`, {
          method: 'POST'
        });
        
        if (startResponse.ok) {
          const startResult = await startResponse.json();
          console.log('✅ Entrega iniciada:', startResult.message);
        } else {
          console.error('❌ Error iniciando entrega:', startResponse.status);
        }
      } else {
        console.log(`ℹ️  3. Pedido no está en estado 'accepted' (actual: ${order.messenger_status})`);
      }

      // 4. Test de completar entrega (solo si está en estado 'in_delivery')
      if (order.messenger_status === 'in_delivery') {
        console.log('\n📦 4. Probando completar entrega...');
        const completeResponse = await requestWithAuth(`/api/messenger/orders/${orderId}/complete`, {
          method: 'POST',
          body: JSON.stringify({
            paymentCollected: order.requires_payment ? order.payment_amount : 0,
            deliveryFeeCollected: order.delivery_fee || 0,
            paymentMethod: 'efectivo',
            deliveryNotes: 'Entrega completada exitosamente',
            latitude: 4.6097100,
            longitude: -74.0817500
          })
        });
        
        if (completeResponse.ok) {
          const completeResult = await completeResponse.json();
          console.log('✅ Entrega completada:', completeResult.message);
        } else {
          console.error('❌ Error completando entrega:', completeResponse.status);
          const error = await completeResponse.text();
          console.error('Error details:', error);
        }
      } else {
        console.log(`ℹ️  4. Pedido no está en estado 'in_delivery' (actual: ${order.messenger_status})`);
      }

      // 5. Test de rechazar pedido (solo si está en estado 'assigned')
      if (order.messenger_status === 'assigned') {
        console.log('\n❌ 5. Probando rechazo de pedido...');
        const rejectResponse = await requestWithAuth(`/api/messenger/orders/${orderId}/reject`, {
          method: 'POST',
          body: JSON.stringify({
            reason: 'Test de rechazo - pedido de prueba'
          })
        });
        
        if (rejectResponse.ok) {
          const rejectResult = await rejectResponse.json();
          console.log('✅ Pedido rechazado:', rejectResult.message);
        } else {
          console.error('❌ Error rechazando pedido:', rejectResponse.status);
        }
      } else {
        console.log(`ℹ️  5. Pedido no está en estado 'assigned' para rechazar (actual: ${order.messenger_status})`);
      }

      // 6. Test de marcar entrega como fallida (solo si está en estado 'in_delivery')
      if (order.messenger_status === 'in_delivery') {
        console.log('\n⚠️  6. Probando marcar entrega como fallida...');
        const failResponse = await requestWithAuth(`/api/messenger/orders/${orderId}/mark-failed`, {
          method: 'POST',
          body: JSON.stringify({
            reason: 'Test de entrega fallida - cliente no disponible'
          })
        });
        
        if (failResponse.ok) {
          const failResult = await failResponse.json();
          console.log('✅ Entrega marcada como fallida:', failResult.message);
        } else {
          console.error('❌ Error marcando entrega como fallida:', failResponse.status);
        }
      } else {
        console.log(`ℹ️  6. Pedido no está en estado 'in_delivery' para marcar como fallida (actual: ${order.messenger_status})`);
      }

    } else {
      console.log('ℹ️  No hay pedidos asignados para probar el flujo completo');
    }

    // 7. Test de resumen diario
    console.log('\n📊 7. Probando resumen diario...');
    const summaryResponse = await requestWithAuth('/api/messenger/daily-summary');
    
    if (summaryResponse.ok) {
      const summaryData = await summaryResponse.json();
      console.log('✅ Resumen diario obtenido:', {
        date: summaryData.data.date,
        summary: summaryData.data.summary,
        recentOrdersCount: summaryData.data.recent_orders?.length || 0
      });
    } else {
      console.error('❌ Error obteniendo resumen diario:', summaryResponse.status);
    }

  } catch (error) {
    console.error('❌ Error en test de flujo de mensajero:', error);
  }
}

// Función para probar la estructura de datos que espera el frontend
async function testFrontendDataStructure() {
  console.log('\n🎨 === TESTING FRONTEND DATA STRUCTURE ===');

  try {
    const ordersResponse = await requestWithAuth('/api/messenger/orders');
    
    if (!ordersResponse.ok) {
      console.error('❌ Error obteniendo pedidos para frontend:', ordersResponse.status);
      return;
    }
    
    const ordersData = await ordersResponse.json();
    
    if (ordersData.data && ordersData.data.length > 0) {
      const order = ordersData.data[0];
      
      console.log('🔍 Estructura de datos para frontend:');
      console.log('- order_number:', order.order_number ? '✅' : '❌');
      console.log('- client_name/customer_name:', (order.client_name || order.customer_name) ? '✅' : '❌');
      console.log('- client_phone/customer_phone:', (order.client_phone || order.customer_phone) ? '✅' : '❌');
      console.log('- total_amount:', order.total_amount ? '✅' : '❌');
      console.log('- status:', order.status ? '✅' : '❌');
      console.log('- messenger_status:', order.messenger_status ? '✅' : '❌');
      console.log('- assigned_messenger_id:', typeof order.assigned_messenger_id === 'number' ? '✅' : '❌');
      console.log('- delivery_address:', order.delivery_address ? '✅' : '❌');
      console.log('- shipping_date:', order.shipping_date ? '✅' : '❌');

      // Verificar campos críticos para los botones del frontend
      console.log('\n🔘 Verificación de campos para botones:');
      console.log('- Campo assigned_messenger_id:', order.assigned_messenger_id);
      console.log('- Campo messenger_status:', order.messenger_status);
      console.log('- Campo status:', order.status);
      
      // Simular lógica de botones del frontend
      const mockUserId = 1; // Simular ID del mensajero
      console.log('- Mock user ID:', mockUserId);
      
      if (order.assigned_messenger_id === mockUserId) {
        console.log('✅ Pedido asignado a este mensajero');
        
        if (order.messenger_status === 'assigned') {
          console.log('✅ Debe mostrar botones: ACEPTAR y RECHAZAR');
        } else if (order.messenger_status === 'accepted') {
          console.log('✅ Debe mostrar botón: INICIAR ENTREGA');
        } else if (order.messenger_status === 'in_delivery') {
          console.log('✅ Debe mostrar botones: COMPLETAR ENTREGA y MARCAR FALLIDA');
        } else {
          console.log('ℹ️  Estado no reconocido para botones:', order.messenger_status);
        }
      } else {
        console.log('❌ Pedido NO asignado a este mensajero');
      }

    } else {
      console.log('❌ No hay datos de pedidos para verificar estructura');
    }

  } catch (error) {
    console.error('❌ Error verificando estructura de datos:', error);
  }
}

// Ejecutar todos los tests
async function runAllTests() {
  console.log('🚀 Iniciando tests completos del sistema de mensajeros...\n');
  
  // Nota: Necesitas un token válido de mensajero para que funcionen estos tests
  console.log('⚠️  IMPORTANTE: Asegúrate de tener un token de mensajero válido en la variable "token"');
  console.log('⚠️  IMPORTANTE: Asegúrate de que el backend esté ejecutándose en puerto 3001\n');
  
  await testMessengerFlow();
  await testFrontendDataStructure();
  
  console.log('\n✅ Tests completados!');
  console.log('\n📋 RESUMEN DE IMPLEMENTACIÓN:');
  console.log('1. ✅ Frontend ahora usa /api/messenger/orders para mensajeros');
  console.log('2. ✅ Manejo de campos client_name/customer_name y client_phone/customer_phone');
  console.log('3. ✅ Lógica de botones basada en messenger_status y assigned_messenger_id');
  console.log('4. ✅ Flujo completo: asignar → aceptar → iniciar → completar/fallar');
  console.log('5. ✅ Opción de rechazar pedidos asignados');
}

// Solo ejecutar si se llama directamente
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testMessengerFlow,
  testFrontendDataStructure,
  runAllTests
};
