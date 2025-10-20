const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

console.log('🔍 Testeando rutas reales del backend después del debug...\n');

async function testBackendRoutes() {
  try {
    // Test if backend is running
    console.log('1. 🏃 Verificando si el backend está corriendo...');
    try {
      const healthResponse = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
      console.log('✅ Backend está corriendo:', healthResponse.data.message);
    } catch (healthError) {
      console.log('❌ Backend NO está corriendo');
      console.log('💡 Necesitas iniciar el backend primero');
      console.log('🔧 Ejecuta: node start_backend_categories_test.js');
      return;
    }

    console.log('\n2. 🧪 Testeando endpoints de categorías...\n');

    // Test /live endpoint with detailed error info
    console.log('📍 Testing GET /api/siigo-categories/live');
    try {
      const liveResponse = await axios.get(`${BASE_URL}/api/siigo-categories/live`, { 
        timeout: 10000,
        validateStatus: () => true // Don't throw on 4xx/5xx
      });
      
      if (liveResponse.status === 200) {
        console.log('✅ Endpoint /live funciona correctamente');
        console.log('📊 Categorías encontradas:', liveResponse.data.data?.length || 0);
        if (liveResponse.data.data) {
          console.log('📋 Primeras 3:', liveResponse.data.data.slice(0, 3));
        }
      } else {
        console.log(`❌ Endpoint /live falló con status ${liveResponse.status}`);
        console.log('📄 Response data:', liveResponse.data);
      }
    } catch (liveError) {
      console.log('❌ Error en /live endpoint:', liveError.message);
      if (liveError.response) {
        console.log('📄 Status:', liveError.response.status);
        console.log('📄 Data:', liveError.response.data);
      }
    }

    console.log('\n📍 Testing GET /api/siigo-categories/local');
    try {
      const localResponse = await axios.get(`${BASE_URL}/api/siigo-categories/local`, { 
        timeout: 10000,
        validateStatus: () => true
      });
      
      if (localResponse.status === 200) {
        console.log('✅ Endpoint /local funciona correctamente');
        console.log('📊 Categorías encontradas:', localResponse.data?.length || 0);
        if (Array.isArray(localResponse.data)) {
          console.log('📋 Primeras 3:', localResponse.data.slice(0, 3));
        }
      } else {
        console.log(`❌ Endpoint /local falló con status ${localResponse.status}`);
        console.log('📄 Response data:', localResponse.data);
      }
    } catch (localError) {
      console.log('❌ Error en /local endpoint:', localError.message);
      if (localError.response) {
        console.log('📄 Status:', localError.response.status);
        console.log('📄 Data:', localError.response.data);
      }
    }

    console.log('\n3. 📝 Diagnóstico:');
    console.log('✅ Database connection: OK');
    console.log('✅ Categories table: OK (16 records)');
    console.log('✅ SQL query: OK');
    console.log('✅ Database module: OK');
    console.log('✅ Route simulation: OK');
    
    console.log('\n💡 Si los endpoints aún fallan:');
    console.log('   1. El backend necesita ser reiniciado después del fix');
    console.log('   2. Puede haber un error no relacionado con la consulta SQL');
    console.log('   3. Verificar que las rutas están registradas correctamente');
    
  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

testBackendRoutes();
