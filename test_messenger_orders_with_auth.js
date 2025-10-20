const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

console.log('🧪 Probando endpoints de mensajero con autenticación real...\n');

async function testMessengerEndpoints() {
  try {
    // 1. Autenticarse como mensajero
    console.log('🔑 1. Iniciando sesión como mensajero...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      username: 'mensajero1',
      password: 'mensajero123'
    });

    if (!loginResponse.data.success) {
      console.log('❌ Error de login:', loginResponse.data.message);
      return;
    }

    const token = loginResponse.data.data.token;
    console.log('✅ Login exitoso - Token obtenido');

    // Headers con autenticación
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 2. Obtener pedidos asignados
    console.log('\n🔍 2. Obteniendo pedidos asignados al mensajero...');
    const ordersResponse = await axios.get(`${BASE_URL}/messenger/orders`, { headers });
    
    console.log('✅ Status:', ordersResponse.status);
    console.log('📋 Respuesta:', JSON.stringify(ordersResponse.data, null, 2));

    if (ordersResponse.data.success) {
      const orders = ordersResponse.data.data || [];
      console.log(`\n📊 Pedidos encontrados: ${orders.length}`);
      
      if (orders.length > 0) {
        console.log('\n📦 Pedidos asignados al mensajero:');
        orders.forEach((order, index) => {
          console.log(`  ${index + 1}. Pedido #${order.order_number}`);
          console.log(`     Estado: ${order.status}`);
          console.log(`     Cliente: ${order.customer_name}`);
          console.log(`     Total: $${order.total}`);
          console.log(`     Método de envío: ${order.delivery_method}`);
          console.log(`     Mensajero: ${order.messenger_name}`);
          console.log('');
        });
      } else {
        console.log('\n📋 No hay pedidos asignados a este mensajero');
        console.log('💡 Posibles razones:');
        console.log('   - No hay pedidos en estado "listo_para_entrega"');
        console.log('   - No hay pedidos asignados específicamente a mensajero1');
        console.log('   - Los pedidos no tienen delivery_method = "mensajeria_local"');
      }
    } else {
      console.log('❌ Error en la respuesta:', ordersResponse.data.message);
    }

    // 3. Verificar información del usuario actual
    console.log('\n👤 3. Verificando información del usuario...');
    const profileResponse = await axios.get(`${BASE_URL}/auth/profile`, { headers });
    console.log('✅ Usuario actual:', profileResponse.data.data.username);
    console.log('✅ Rol:', profileResponse.data.data.role);

    // 4. Probar que el endpoint devuelve la estructura correcta
    console.log('\n🔍 4. Verificando estructura de la respuesta...');
    console.log('📋 Campos esperados en cada pedido:');
    console.log('   - id, order_number, status, customer_name, total');
    console.log('   - delivery_method, messenger_name, created_at');
    console.log('   - customer_phone, delivery_address, notes');

  } catch (error) {
    console.error('❌ Error en las pruebas:', error.message);
    if (error.response) {
      console.error('📋 Status:', error.response.status);
      console.error('📋 Data:', error.response.data);
    }
  }
}

// Ejecutar pruebas
testMessengerEndpoints();
