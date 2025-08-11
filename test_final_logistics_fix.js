// Test final para verificar que ambos pedidos aparezcan en la categoría mensajería local

const axios = require('axios');

async function testFinalLogisticsFix() {
  console.log('🔍 TESTEANDO FIX FINAL DE MENSAJERÍA LOCAL...\n');
  
  try {
    // Hacer request al endpoint real
    const response = await axios.get('http://localhost:3001/api/logistics/ready-for-delivery', {
      headers: {
        'Authorization': 'Bearer test-token-logistica'
      }
    });
    
    if (response.data.success) {
      const { groupedOrders, stats } = response.data.data;
      
      console.log('✅ Endpoint respondió exitosamente');
      console.log('📊 Estadísticas:', stats);
      console.log('');
      
      // Verificar mensajería local
      if (groupedOrders.mensajeria_local && groupedOrders.mensajeria_local.length > 0) {
        console.log('🎯 ¡MENSAJERÍA LOCAL ENCONTRADA!');
        console.log('   Cantidad:', groupedOrders.mensajeria_local.length);
        
        groupedOrders.mensajeria_local.forEach(order => {
          console.log(`   - ${order.order_number} (${order.customer_name}) - Carrier: ${order.carrier_name}`);
        });
        
        // Verificar específicamente FV-2-12752 y FV-2-12753
        const order12752 = groupedOrders.mensajeria_local.find(o => o.order_number === 'FV-2-12752');
        const order12753 = groupedOrders.mensajeria_local.find(o => o.order_number === 'FV-2-12753');
        
        console.log('');
        console.log('🔍 VERIFICACIÓN ESPECÍFICA:');
        console.log('   FV-2-12752:', order12752 ? '✅ ENCONTRADO' : '❌ NO ENCONTRADO');
        console.log('   FV-2-12753:', order12753 ? '✅ ENCONTRADO' : '❌ NO ENCONTRADO');
        
        if (order12752 && order12753) {
          console.log('');
          console.log('🎉 ¡ÉXITO COMPLETO! Ambos pedidos aparecen correctamente en Mensajería Local');
        } else if (order12752 || order12753) {
          console.log('');
          console.log('⚠️  ÉXITO PARCIAL: Solo uno de los pedidos aparece en Mensajería Local');
        } else {
          console.log('');
          console.log('❌ Los pedidos objetivo no aparecen en Mensajería Local');
        }
        
      } else {
        console.log('❌ No hay pedidos en mensajería local');
      }
      
      // Verificar si están en otras categorías
      console.log('');
      console.log('📋 VERIFICANDO OTRAS CATEGORÍAS:');
      Object.keys(groupedOrders).forEach(category => {
        const orders = groupedOrders[category];
        if (orders.length > 0 && category !== 'mensajeria_local') {
          const targetOrders = orders.filter(o => 
            o.order_number === 'FV-2-12752' || o.order_number === 'FV-2-12753'
          );
          if (targetOrders.length > 0) {
            console.log(`   ${category}: ${targetOrders.map(o => o.order_number).join(', ')}`);
          }
        }
      });
      
    } else {
      console.log('❌ Error en el endpoint:', response.data.message);
    }
    
  } catch (error) {
    console.error('❌ Error ejecutando test:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

testFinalLogisticsFix().catch(console.error);
