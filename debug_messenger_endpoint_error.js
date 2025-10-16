const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

console.log('🐛 Debugging error específico del endpoint de mensajeros...\n');

async function debugMessengerEndpoint() {
  try {
    // 1. Autenticarse como mensajero
    console.log('🔑 1. Iniciando sesión como mensajero...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      username: 'mensajero1',
      password: 'mensajero123'
    });

    const token = loginResponse.data.data.token;
    console.log('✅ Login exitoso - Token obtenido');
    console.log('👤 Usuario ID:', loginResponse.data.data.user.id);
    console.log('👤 Rol:', loginResponse.data.data.user.role);

    // Headers con autenticación
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 2. Intentar obtener pedidos con más detalles del error
    console.log('\n🔍 2. Intentando obtener pedidos...');
    
    try {
      const ordersResponse = await axios.get(`${BASE_URL}/messenger/orders`, { headers });
      console.log('✅ Status:', ordersResponse.status);
      console.log('📋 Respuesta:', JSON.stringify(ordersResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Error en la petición:');
      console.log('   Status:', error.response?.status);
      console.log('   Status Text:', error.response?.statusText);
      console.log('   Data:', error.response?.data);
      console.log('   Headers:', error.response?.headers);
      
      if (error.response?.data?.message) {
        console.log('\n📝 Mensaje específico del servidor:', error.response.data.message);
      }
    }

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

debugMessengerEndpoint();
