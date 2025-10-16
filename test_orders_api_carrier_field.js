// Test para verificar si el API de órdenes incluye carrier_id

const API_BASE = 'http://localhost:3001/api';

async function testOrdersAPI() {
  try {
    console.log('🔍 TESTING ORDERS API - CARRIER_ID FIELD\n');
    
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3MzU2OTcwMTMsImV4cCI6MTczNTc4MzQxM30.NJl8X6yNhDRu4OLhCnfWqTNcuZlMqLBa6-iAEO_w5dI'; // Token de admin
    
    const response = await fetch(`${API_BASE}/orders?status=en_logistica`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('📊 Response Status:', response.status);
    console.log('📋 Total Orders:', data.data?.orders?.length || 0);
    console.log('');
    
    // Buscar específicamente el pedido FV-2-12752
    const targetOrder = data.data?.orders?.find(o => o.order_number === 'FV-2-12752');
    
    if (targetOrder) {
      console.log('✅ PEDIDO FV-2-12752 ENCONTRADO EN API:');
      console.log('📦 Order ID:', targetOrder.id);
      console.log('🚚 Carrier ID:', targetOrder.carrier_id);
      console.log('📦 Delivery Method:', targetOrder.delivery_method);
      console.log('📋 Status:', targetOrder.status);
      console.log('');
      console.log('🔍 CAMPOS COMPLETOS DEL PEDIDO:');
      console.log(JSON.stringify(targetOrder, null, 2));
    } else {
      console.log('❌ PEDIDO FV-2-12752 NO ENCONTRADO EN API');
      console.log('');
      console.log('📋 PEDIDOS DISPONIBLES:');
      data.data?.orders?.forEach(order => {
        console.log(`- ${order.order_number} (ID: ${order.id})`);
      });
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

testOrdersAPI();
