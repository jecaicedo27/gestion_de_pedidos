const axios = require('axios');

async function debugShippingPayment() {
  console.log('🔍 DEBUG: Verificando shipping_payment_method en endpoint de logística');
  console.log('==============================================================\n');
  
  try {
    // 1. Obtener token de autenticación
    console.log('1️⃣ Obteniendo token de autenticación...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Token obtenido\n');
    
    // 2. Obtener pedidos en logística
    console.log('2️⃣ Obteniendo pedidos en logística...');
    const ordersResponse = await axios.get('http://localhost:3001/api/logistics/orders', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const orders = ordersResponse.data.data.orders;
    console.log(`✅ ${orders.length} pedidos encontrados\n`);
    
    // 3. Buscar pedido 12670
    console.log('3️⃣ Buscando pedido FV-2-12670...');
    const order12670 = orders.find(o => o.order_number === 'FV-2-12670');
    
    if (order12670) {
      console.log('✅ Pedido FV-2-12670 encontrado:');
      console.log('- ID:', order12670.id);
      console.log('- Cliente:', order12670.customer_name);
      console.log('- payment_method:', order12670.payment_method);
      console.log('- shipping_payment_method:', order12670.shipping_payment_method);
      console.log('- delivery_method:', order12670.delivery_method);
      
      if (order12670.shipping_payment_method) {
        console.log('\n✅ CAMPO shipping_payment_method ESTÁ PRESENTE EN LA RESPUESTA');
      } else {
        console.log('\n❌ CAMPO shipping_payment_method NO ESTÁ EN LA RESPUESTA');
      }
    } else {
      console.log('❌ Pedido FV-2-12670 no encontrado en logística');
    }
    
    // 4. Mostrar estructura de un pedido de ejemplo
    if (orders.length > 0) {
      console.log('\n4️⃣ Estructura de ejemplo del primer pedido:');
      console.log(JSON.stringify(orders[0], null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Respuesta del servidor:', error.response.data);
    }
  }
}

// Ejecutar debug
debugShippingPayment();
