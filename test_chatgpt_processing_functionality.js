const axios = require('axios');

console.log('🧪 Testing ChatGPT Processing Functionality');
console.log('==========================================');

// Configuración de la API
const API_BASE = 'http://localhost:3001/api';

async function testChatGPTProcessing() {
  try {
    console.log('📋 1. Testing backend connectivity...');
    
    // Test basic connectivity
    try {
      const healthResponse = await axios.get(`${API_BASE}/health`, { timeout: 5000 });
      console.log('✅ Backend health check:', healthResponse.status);
    } catch (error) {
      console.log('❌ Backend health check failed:', error.message);
    }
    
    // Test quotations endpoint
    console.log('\n📋 2. Testing quotations endpoints...');
    try {
      const quotationsResponse = await axios.get(`${API_BASE}/quotations`, { 
        timeout: 5000,
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });
      console.log('✅ Quotations endpoint responding:', quotationsResponse.status);
    } catch (error) {
      console.log('❌ Quotations endpoint error:', error.response?.status || error.message);
      if (error.response?.data) {
        console.log('   Error details:', error.response.data);
      }
    }
    
    // Test ChatGPT processing endpoint
    console.log('\n📋 3. Testing ChatGPT processing endpoint...');
    const testData = {
      description: "Quiero 5 kilos de arroz y 2 litros de aceite",
      customerInfo: "Cliente de prueba"
    };
    
    try {
      const chatgptResponse = await axios.post(`${API_BASE}/quotations/process-with-chatgpt`, testData, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      });
      console.log('✅ ChatGPT processing endpoint responding:', chatgptResponse.status);
      console.log('   Response data:', JSON.stringify(chatgptResponse.data, null, 2));
    } catch (error) {
      console.log('❌ ChatGPT processing endpoint error:', error.response?.status || error.message);
      if (error.response?.data) {
        console.log('   Error details:', JSON.stringify(error.response.data, null, 2));
      }
    }
    
    // Test image processing endpoint
    console.log('\n📋 4. Testing image processing endpoint...');
    try {
      const imageResponse = await axios.post(`${API_BASE}/quotations/process-image-order`, {
        description: "Imagen de pedido de prueba"
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      });
      console.log('✅ Image processing endpoint responding:', imageResponse.status);
    } catch (error) {
      console.log('❌ Image processing endpoint error:', error.response?.status || error.message);
      if (error.response?.data) {
        console.log('   Error details:', JSON.stringify(error.response.data, null, 2));
      }
    }
    
    // Test backend server routes
    console.log('\n📋 5. Testing backend server status...');
    try {
      const serverResponse = await axios.get(`${API_BASE}/status`, { timeout: 5000 });
      console.log('✅ Server status endpoint responding:', serverResponse.status);
    } catch (error) {
      console.log('❌ Server status endpoint error:', error.response?.status || error.message);
    }
    
    // Test any available endpoint to confirm backend is running
    console.log('\n📋 6. Testing any available endpoint...');
    const testEndpoints = [
      '/config/public',
      '/auth/verify', 
      '/users',
      '/orders',
      '/customers'
    ];
    
    for (const endpoint of testEndpoints) {
      try {
        const response = await axios.get(`${API_BASE}${endpoint}`, { 
          timeout: 5000,
          validateStatus: () => true // Don't throw on 4xx/5xx
        });
        console.log(`✅ ${endpoint}: ${response.status} ${response.statusText}`);
        break; // Si encontramos una respuesta, salimos del loop
      } catch (error) {
        console.log(`❌ ${endpoint}: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Test general error:', error.message);
  }
}

// Test directo al puerto 3001
async function testDirectPort() {
  console.log('\n🔍 Testing direct port 3001 connection...');
  try {
    const response = await axios.get('http://localhost:3001/', { 
      timeout: 5000,
      validateStatus: () => true
    });
    console.log('✅ Port 3001 responding:', response.status);
    console.log('   Response:', response.data?.substring(0, 200) || 'No data');
  } catch (error) {
    console.log('❌ Port 3001 error:', error.message);
  }
}

async function runAllTests() {
  await testDirectPort();
  await testChatGPTProcessing();
  
  console.log('\n📊 DIAGNÓSTICO:');
  console.log('===============');
  console.log('Si ves errores de conexión (ECONNREFUSED), el backend no está funcionando correctamente.');
  console.log('Si ves errores 401/403, el backend funciona pero falta autenticación.');
  console.log('Si ves errores 404, el backend funciona pero faltan rutas específicas.');
  console.log('Si ves errores 500, hay problemas internos del servidor (posiblemente base de datos).');
  console.log('\n✨ Test completado');
}

runAllTests().catch(error => {
  console.error('❌ Error running tests:', error.message);
  process.exit(1);
});
